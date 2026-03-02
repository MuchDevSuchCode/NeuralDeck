const fs = require('fs');

async function main() {
    const reqBody = {
        model: "glm-4.7-flash-claude-4.5-opus-q6_k.gguf",
        messages: [
            { role: "user", content: "When was the RTX 5090 released?" },
            {
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: "rFSPUTJfjGyhNCqSjr5IBAxxUsY5Lmet",
                        type: "function",
                        function: {
                            name: "web_search",
                            arguments: "{\"query\":\"RTX 5090 release date\"}"
                        }
                    }
                ]
            },
            {
                role: "tool",
                tool_call_id: "rFSPUTJfjGyhNCqSjr5IBAxxUsY5Lmet",
                name: "web_search", // Let's add name just in case
                content: JSON.stringify({
                    query: "RTX 5090 release date",
                    results: [
                        {
                            title: "NVIDIA GeForce RTX 5090 Specs | TechPowerUp",
                            link: "https://www.techpowerup.com/gpu-specs/geforce-rtx-5090.c4216",
                            snippet: "The GeForce RTX 5090 is an enthusiast-class graphics card by NVIDIA, launched on January 30th, 2025. It features 21760 shading units..."
                        }
                    ]
                })
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "web_search",
                    description: "Search the web for factual information",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string" } },
                        required: ["query"]
                    }
                }
            }
        ]
    };

    const res = await fetch('http://halo.lan:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
    });

    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}

main().catch(console.error);
