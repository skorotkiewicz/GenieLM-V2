# GenieLM

<!--![Bun](https://img.shields.io/badge/Bun-runtime-000000?style=flat-square&logo=bun&logoColor=white)-->
![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-framework-FF4154?style=flat-square&logo=tanstack&logoColor=white)
[![Astryx](https://img.shields.io/badge/Astryx-0.7.17-6D5EF7?style=flat-square)](https://astryx.atmeta.com/)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![SQLite Vector](https://img.shields.io/badge/SQLite_Vector-vector_search-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/sqliteai/sqlite-vector)
[![Embedding model](https://img.shields.io/badge/Embedding-multilingual--e5--small-0A7BBB?style=flat-square&logo=huggingface&logoColor=white)](https://huggingface.co/Xenova/multilingual-e5-small)

<p align="center">
  <img src="docs/genielm-in-action.png" alt="GenieLM answering a launch-planning question with a completed web search" width="1100">
</p>

GenieLM is a React chat client for OpenAI-compatible models and ChatGPT OAuth. It uses TanStack Start and Astryx. The server streams responses, and the browser stores conversations.

Previous Svelte version: [GenieLM on GitHub](https://github.com/skorotkiewicz/GenieLM).

## Run locally

Install Bun and Node.js 22.13 or newer.

```sh
bun install
bun run sandbox:build # optional, needed for the code execution tool
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Select **Choose a model** and enter your OpenAI-compatible base URL, model name, and optional API key. Include the API prefix in the base URL. To use ChatGPT, select **ChatGPT** and follow the sign-in prompts for the community-maintained browser extension. The integration is unofficial.

Build and start the production server with:

```sh
bun run build
bun run start
```

The production server listens on the local loopback interface on port 3000 by default.

## Local knowledge

Download the multilingual E5 embedding model with the Hugging Face CLI before indexing documents:

```sh
hf download Xenova/multilingual-e5-small \
  config.json tokenizer.json tokenizer_config.json special_tokens_map.json \
  sentencepiece.bpe.model onnx/model_quantized.onnx \
  --local-dir multilingual-e5-small
```

GenieLM checks indexed documents and saved memories at the start of each turn. It can automatically save lasting preferences and project facts for future conversations. Select **Local knowledge** to manage documents and memories, or ask GenieLM to forget a memory. The server keeps the documents, memories, and embeddings in `knowledge.db`.

The optional code tool uses an isolated rootless Podman container. Run `bun run sandbox:build` to build its image.

## Moving from Svelte

GenieLM reads the existing conversation and provider settings when opened at the same browser origin as the Svelte app. Use the same scheme, hostname, and port to see the old history. API keys remain scoped to the browser tab. To carry over the local knowledge index, stop both apps and place the existing `knowledge.db` and `multilingual-e5-small/` in the React project directory.

## Checks

```sh
bun run typecheck
bun test src
bun run check
bun run build
bunx astryx doctor --built dist/client
```
