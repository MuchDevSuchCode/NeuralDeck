#!/usr/bin/env python3

import subprocess
import json
import shutil
import sys
import time
import argparse
import re
import os
import psutil
from pathlib import Path
from typing import List, Dict, Optional, TypeAlias

try:
    from tabulate import tabulate
except Exception:
    tabulate = None

# --- Colors ---
C_END = "\033[0m"
C_GRN = "\033[92m"
C_YEL = "\033[93m"
C_RED = "\033[91m"
C_CYN = "\033[96m"
C_GRY = "\033[90m"
C_B_CYN = "\033[1;96m"
C_B_BLU = "\033[1;94m"
C_DIM = "\033[2m"

# Box Drawing
B_TL = f"{C_B_BLU}┏{C_END}"
B_TR = f"{C_B_BLU}┓{C_END}"
B_BL = f"{C_B_BLU}┗{C_END}"
B_BR = f"{C_B_BLU}┛{C_END}"
B_H  = f"{C_B_BLU}━{C_END}"
B_V  = f"{C_B_BLU}┃{C_END}"
B_ML = f"{C_B_BLU}┣{C_END}"
B_MR = f"{C_B_BLU}┫{C_END}"

# --- 1. Type Definitions ---
GpuData : TypeAlias = Dict[str, Optional[int | float | str]]
GpuList : TypeAlias = List[GpuData]
JsonData : TypeAlias = Dict

# --- 2. Helper Functions ---
def safe_float(value) -> Optional[float]:
    if value is None or value == '' or str(value).lower() in ['n/a', '[n/a]', '[not supported]']:
        return None
    try:
        if isinstance(value, str):
            value = re.sub(r'[^\d.-]', '', value)
        return float(value)
    except Exception:
        return None

def create_gpu_info(index: int, name: str, vendor: str, **kwargs) -> GpuData:
    gpu = {
        'index': index, 'name': name, 'vendor': vendor,
        'utilization': 0.0, 'memory_used': 0.0, 'memory_total': 0.0,
        'temperature': 0.0, 'power_draw': 0.0, 'clock_graphics': 0.0,
        'fan_rpm': 0
    }
    gpu.update(kwargs)
    return gpu

def check_amd() -> bool: 
    return shutil.which('rocm-smi') is not None or os.path.exists("/sys/class/drm/card0/device/gpu_busy_percent")

def get_color(val, warn, crit):
    if val is None or val == "N/A": return C_GRY
    try:
        v = float(val)
        if v >= crit: return C_RED
        if v >= warn: return C_YEL
        return C_GRN
    except:
        return C_END

def make_bar(percent: float, width: int = 5) -> str:
    filled = int((percent / 100.0) * width)
    empty = width - filled
    color = get_color(percent, 60, 85)
    return f"[{color}{'|' * filled}{C_END}{' ' * empty}]"

# --- 3. Hardware & System Logic ---
def get_cpu_metrics():
    cpu_temp, cpu_volts = None, None
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        for name, entries in temps.items():
            if name in ['k10temp', 'zenpower', 'amdgpu', 'coretemp']:
                for entry in entries:
                    if entry.label in ['Tdie', 'Tctl', 'edge', ''] and entry.current > 0:
                        cpu_temp = entry.current
                        break
                if cpu_temp: break

    for hwmon in Path('/sys/class/hwmon/').glob('hwmon*'):
        try:
            with open(hwmon / 'name', 'r') as f: name = f.read().strip()
            if name in ['k10temp', 'zenpower']:
                if (hwmon / 'in0_input').exists():
                    with open(hwmon / 'in0_input', 'r') as f: cpu_volts = float(f.read().strip()) / 1000.0
                if not cpu_temp and (hwmon / 'temp1_input').exists():
                    with open(hwmon / 'temp1_input', 'r') as f: cpu_temp = float(f.read().strip()) / 1000.0
        except: continue
    return cpu_temp, cpu_volts

def get_npu_metrics():
    npu_util, npu_pwr = "N/A", "N/A"
    if shutil.which('xrt-smi'):
        try:
            res_util = subprocess.run(['xrt-smi', 'examine', '-r', 'utilization'], capture_output=True, text=True, timeout=0.2)
            m_util = re.search(r'Utilization.*?:\s*(\d+(\.\d+)?)', res_util.stdout, re.IGNORECASE)
            if m_util: npu_util = f"{m_util.group(1)}%"
        except: pass
    if npu_util == "N/A":
        for accel in Path('/sys/class/accel/').glob('accel*'):
            try:
                if (accel / 'device/npu_busy_percent').exists():
                    with open(accel / 'device/npu_busy_percent', 'r') as f: npu_util = f"{f.read().strip()}%"
                if (accel / 'device/power_now').exists():
                    with open(accel / 'device/power_now', 'r') as f: npu_pwr = f"{float(f.read().strip()) / 1000000:.1f}W"
            except: continue
    return npu_util, npu_pwr

def get_gpu_fan_rpm(card_index=0):
    try:
        hwmon_dir = list(Path(f"/sys/class/drm/card{card_index}/device/hwmon/").glob("hwmon*"))
        if hwmon_dir and (hwmon_dir[0] / "fan1_input").exists():
            with open(hwmon_dir[0] / "fan1_input", 'r') as f: return int(f.read().strip())
    except: pass
    return 0

def query_amd() -> GpuList:
    if not check_amd(): return []
    gpus: GpuList = []
    try:
        result = subprocess.run(['rocm-smi', '--all', '--json'], capture_output=True, text=True, timeout=1)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            for key, metrics in data.items():
                if not isinstance(metrics, dict): continue
                idx_match = re.search(r'\d+', key)
                idx = int(idx_match.group()) if idx_match else 0
                
                m_used_raw = safe_float(metrics.get('VRAM Total Used (B)')) or safe_float(metrics.get('VRAM Total Used (MiB)'))
                m_total_raw = safe_float(metrics.get('VRAM Total Memory (B)')) or safe_float(metrics.get('VRAM Total Memory (MiB)'))
                m_used = m_used_raw / (1024**2) if (m_used_raw and m_used_raw > 20000) else (m_used_raw or 0.0)
                m_total = m_total_raw / (1024**2) if (m_total_raw and m_total_raw > 20000) else (m_total_raw or 0.0)

                gpus.append(create_gpu_info(
                    index=idx, name=metrics.get('Card series', 'AMD Strix Halo APU'), vendor='amd',
                    utilization=safe_float(metrics.get('GPU use (%)')) or 0.0,
                    memory_used=m_used, memory_total=m_total,
                    temperature=safe_float(metrics.get('Temperature (Sensor edge) (C)')),
                    power_draw=safe_float(metrics.get('Average Graphics Package Power (W)')),
                    fan_rpm=get_gpu_fan_rpm(idx)
                ))
            if gpus: return gpus
    except: pass

    for card_path in Path("/sys/class/drm/").glob("card*"):
        busy_path = card_path / "device/gpu_busy_percent"
        if busy_path.exists():
            try:
                with open(busy_path, 'r') as f: util = float(f.read().strip())
                with open(card_path / "device/mem_info_vram_used", 'r') as f: m_used = float(f.read().strip()) / (1024**2)
                with open(card_path / "device/mem_info_vram_total", 'r') as f: m_total = float(f.read().strip()) / (1024**2)
                idx = int(card_path.name.replace('card', ''))
                gpus.append(create_gpu_info(
                    index=idx, name="Strix Halo (Kernel Sysfs)", vendor="amd",
                    utilization=util, memory_used=m_used, memory_total=m_total, fan_rpm=get_gpu_fan_rpm(idx)
                ))
            except: continue
    return gpus

# --- 4. Printing & UI ---
# --- ASCII Art & Logos ---
SKULL = [
    f"{C_RED}        .aad888888baa.        {C_END}",
    f"{C_RED}     .d?88888888888?8b.       {C_END}",
    f"{C_RED}   .d888?88888888??a8888b.    {C_END}",
    f"{C_RED} .d888888a888888aa8888888b.   {C_END}",
    f"{C_RED} = dP :  :  : 88888888 :  : Yb ={C_END}",
    f"{C_RED} = dP : : : : Y888888P : : : Yb={C_END}",
    f"{C_RED} = d8 : : : : Y88888P : : : :8b={C_END}",
    f"{C_RED} = 88 : : : : Y8888P : : : : 88={C_END}",
    f"{C_RED} = Y8baaaaaaaa88P : Y8baaaaaa8P={C_END}",
    f"{C_RED} =  Y8888888888P :  : Y888888P ={C_END}",
    f"{C_RED} =   : : : : 88 : : : : 88 : : ={C_END}",
    f"{C_RED}  . : : : : 888888888888 : : :. {C_END}",
    f"{C_RED}   . : : : : 8888888888 : : : . {C_END}",
    f"{C_RED}    . : : : : 88 : 88 : : : .   {C_END}",
    f"{C_RED}     . : : : : 8 : 8 : : : .    {C_END}",
    f"{C_RED}       = : : : : : : : : =      {C_END}",
    f"{C_RED}           = : : : : =          {C_END}"
]

def pad_str(s, length):
    raw_len = len(re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', s))
    if raw_len < length:
        return s + " " * (length - raw_len)
    return s

def make_hash_bar(percent: float, width: int = 10) -> str:
    filled = int((percent / 100.0) * width)
    empty = width - filled
    color = get_color(percent, 60, 85)
    return f"[{color}{'#' * filled}{C_GRY}{'-' * empty}{C_END}]"

def print_dashboard(io_counters_start, time_delta):
    gpus = query_amd()
    
    sys_mem = psutil.virtual_memory()
    swap_mem = psutil.swap_memory()
    os_ram_gb = sys_mem.total / (1024**3)
    
    vram_total_mb = sum([g.get('memory_total', 0) or 0 for g in gpus]) if gpus else 0
    vram_used_mb = sum([g.get('memory_used', 0) or 0 for g in gpus]) if gpus else 0
    vram_total_gb = vram_total_mb / 1024
    
    phys_ram_gb = os_ram_gb + vram_total_gb
    vram_pct = (vram_used_mb/max(1, vram_total_mb))*100 if vram_total_mb > 0 else 0
    
    cpu_cores = psutil.cpu_percent(interval=None, percpu=True)
    cpu_util = sum(cpu_cores) / len(cpu_cores) if cpu_cores else 0
    cpu_freq = psutil.cpu_freq()
    freq_mhz = cpu_freq.current if cpu_freq else 0.0
    cpu_temp, cpu_volts = get_cpu_metrics()
    npu_util, npu_pwr = get_npu_metrics()

    io_counters_end = psutil.disk_io_counters()
    read_speed_mb = ((io_counters_end.read_bytes - io_counters_start.read_bytes) / (1024**2)) / max(0.1, time_delta)
    write_speed_mb = ((io_counters_end.write_bytes - io_counters_start.write_bytes) / (1024**2)) / max(0.1, time_delta)
    disk_usage = psutil.disk_usage('/')

    # Build Left Column (System Engine)
    left = []
    left.append(f"{C_B_CYN}::: REVERSE-ENGINEERING ::::{C_END}")
    left.append(f"{C_GRY}============================{C_END}")
    left.append(f" {C_YEL}CPU:{C_END} {get_color(cpu_util,60,85)}{cpu_util:>5.1f}%{C_END} [{freq_mhz:>4.0f}MHz]")
    left.append(f" {C_YEL}TMP:{C_END} {get_color(cpu_temp,75,85)}{cpu_temp:>5.1f}C{C_END} | {C_YEL}PWR:{C_END} {cpu_volts or 0:>4.2f}V")
    left.append(f" {C_GRY}--------------------------{C_END}")
    
    for i in range(0, min(8, len(cpu_cores)), 2):
        c1 = cpu_cores[i]
        c2 = cpu_cores[i+1] if i+1 < len(cpu_cores) else 0.0
        s1 = f"C{i:<2} {get_color(c1,60,85)}{c1:>4.1f}%{C_END}"
        s2 = f"C{i+1:<2} {get_color(c2,60,85)}{c2:>4.1f}%{C_END}"
        left.append(f" {s1}  |  {s2}")
        
    left.append(f" {C_GRY}--------------------------{C_END}")
    left.append(f" {C_YEL}RAM:{C_END} {make_hash_bar(sys_mem.percent, 12)} {get_color(sys_mem.percent, 70, 85)}{sys_mem.percent:>4.1f}%{C_END}")
    left.append(f"      {sys_mem.used/(1024**3):>4.1f}GB / {os_ram_gb:>4.1f}GB")

    # Build Right Column (Subsystems / Payload)
    right = []
    right.append(f"{C_B_CYN}:::: EXPLOIT-THE-DATA ::::::{C_END}")
    right.append(f"{C_GRY}============================{C_END}")
    right.append(f" {C_YEL}DISK IO:{C_END} R:{read_speed_mb:>4.1f} W:{write_speed_mb:>4.1f}MB/s")
    right.append(f" {C_YEL}CAPAC :{C_END} {make_hash_bar(disk_usage.percent, 12)} {get_color(disk_usage.percent, 80, 95)}{disk_usage.percent:>4.1f}%{C_END}")
    right.append(f" {C_GRY}--------------------------{C_END}")
    
    if gpus:
        g = gpus[0]
        right.append(f" {C_YEL}GPU0:{C_END} {get_color(g['utilization'], 70, 90)}{g['utilization']}%{C_END} | {get_color(g['temperature'], 75, 88)}{g['temperature']:.0f}C{C_END} | {g.get('fan_rpm',0)}RPM")
        right.append(f" {C_YEL}VRAM:{C_END} {make_hash_bar(vram_pct, 12)} {get_color(vram_pct, 80, 95)}{vram_pct:>4.1f}%{C_END}")
        right.append(f"       {vram_used_mb/1024:>4.1f}GB / {vram_total_gb:>4.1f}GB")
    else:
        right.append(f" {C_RED}NO GPU SUBSYSTEM DETECTED{C_END}")
        right.append(f" {C_GRY}--------------------------{C_END}")
        right.append("")
        
    right.append(f" {C_GRY}--------------------------{C_END}")
    n_str = npu_util.replace('%', '') if npu_util != "N/A" else "0"
    n_p = safe_float(n_str) or 0.0
    right.append(f" {C_YEL}NPU :{C_END} {make_hash_bar(n_p, 12)} {get_color(n_p, 80, 95)}{n_p:>4.1f}%{C_END}")
    right.append(f" {C_GRY}--------------------------{C_END}")

    # Standardize arrays to length of SKULL
    while len(left) < len(SKULL): left.append("")
    while len(right) < len(SKULL): right.append("")
    
    print(f"{C_RED}-={C_END}{C_YEL}={C_END}{C_RED}=-"*28)
    for i in range(len(SKULL)):
        l_str = pad_str(left[i], 30)
        c_str = pad_str(SKULL[i], 32)
        r_str = pad_str(right[i], 30)
        print(f" {l_str} {c_str} {r_str}\033[K")
        
    print(f"{C_RED}-={C_END}{C_YEL}={C_END}{C_RED}=-"*28)
    print(f"{C_RED}+WARNING+ \"Illegal_Network_Connections_Beyond_Login\"{C_END}")
    print(f"{C_YEL}  |H4CK3R|      -= You are at the point of NO RETURN =-      |H4CK3R|{C_END}")
    print(f"{C_YEL}  |______| Your Activities:Will_be_Keylogged_and_Timestamped |______{C_END}")
    print(f"{C_CYN}  NEURAL_DECK_V1 // {phys_ram_gb:.1f}GB TOTAL_SYS_MEM // TARGET_LOCKED{C_END}")
    print()

# --- 5. Main Execution ---
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tail', action='store_true', help='Continuously monitor')
    parser.add_argument('-i', '--interval', type=float, default=1.0, help='Refresh interval in seconds')
    args = parser.parse_args()

    psutil.cpu_percent(interval=None, percpu=True)
    io_counters = psutil.disk_io_counters()
    last_time = time.time()

    if args.tail:
        sys.stdout.write("\033[2J")
        try:
            while True:
                sys.stdout.write("\033[H")
                current_time = time.time()
                time_delta = current_time - last_time
                
                print_dashboard(io_counters, time_delta)
                
                sys.stdout.write("\033[J")
                sys.stdout.flush()
                last_time = current_time
                io_counters = psutil.disk_io_counters()
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nMonitoring stopped.\033[0m")
    else:
        time.sleep(0.5) 
        print_dashboard(io_counters, time.time() - last_time)

if __name__ == "__main__":
    main()
