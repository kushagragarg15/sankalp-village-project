"""
Exact port of server/services/embeddingService.js `chunkText`. Word-count
chunking with overlap — NOT LangChain's RecursiveCharacterTextSplitter,
deliberately: swapping the chunker would move every chunk boundary, which
would change every stored embedding's input text and invalidate the vectors
already sitting in resource_chunks (and the retrieval eval's expectations)
without a full re-embed. Keep this until a deliberate, eval-verified
re-chunking pass.
"""

DEFAULT_MAX_WORDS = 300
DEFAULT_OVERLAP_WORDS = 50


def chunk_text(text: str, max_words: int = DEFAULT_MAX_WORDS, overlap_words: int = DEFAULT_OVERLAP_WORDS) -> list[str]:
    # `text.strip().split()` splits on any run of whitespace and drops empty
    # tokens — the same behaviour as the JS `text.trim().split(/\s+/)`.
    words = text.strip().split()
    if len(words) <= max_words:
        return [text]

    chunks: list[str] = []
    start_idx = 0
    while start_idx < len(words):
        end_idx = min(start_idx + max_words, len(words))
        chunks.append(" ".join(words[start_idx:end_idx]))
        start_idx += max_words - overlap_words
        if start_idx >= len(words):
            break

    return chunks
