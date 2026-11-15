---
title: mevzuat-rag
summary: A chatbot that answers questions from university regulations and cites the article number.
lead: A RAG chatbot that answers questions from Bolu Abant İzzet Baysal University's regulations and shows the document and article number next to every piece of information.
year: 2026
stack: [hybrid retrieval, reranker, gemini, fastapi]
order: 1
github: https://github.com/ariftahab/mevzuat-rag

diagram:
  cols: 6
  caption: documents are split article by article and indexed once; for each question two searches are merged, the most relevant articles are reranked, and the answer is written only from those articles
  groups:
    - { label: every question, cols: [0, 5], rows: [0, 0] }
    - { label: indexing · once, cols: [0, 1], rows: [2, 2] }
  nodes:
    - { id: q, label: question, sub: student wording, col: 0, row: 0 }
    - { id: search, label: hybrid search, sub: BM25 + bge-m3, col: 1, row: 0 }
    - { id: rrf, label: RRF, sub: merge the lists, col: 2, row: 0 }
    - { id: rerank, label: reranker, sub: cross-encoder, col: 3, row: 0 }
    - { id: llm, label: Gemini, sub: only these articles, col: 4, row: 0 }
    - { id: ans, label: answer, sub: "[Directive, Article 8]", col: 5, row: 0, hl: true }
    - { id: idx, label: index, sub: vector + BM25, col: 1, row: 1, store: true }
    - { id: pdf, label: PDFs, sub: 131 documents, col: 0, row: 2 }
    - { id: chunk, label: article chunks, sub: ~3,800 pieces, col: 1, row: 2 }
  edges:
    - { from: q, to: search }
    - { from: search, to: rrf }
    - { from: rrf, to: rerank }
    - { from: rerank, to: llm }
    - { from: llm, to: ans }
    - { from: pdf, to: chunk }
    - { from: chunk, to: idx }
    - { from: idx, to: search, dashed: true }
---

## Summary

mevzuat-rag is a RAG chatbot that answers student questions from Bolu Abant İzzet Baysal University's regulations, directives and academic calendars. Next to every answer it gives the document and article number the information came from; if asked something that isn't in the documents, it says "I don't have information on this." instead of making something up. It works over 131 documents, about 3,800 chunks. On a 111-question validation set written in students' own words, which I never used while tuning the system, 88% of answers are semantically correct.

The real weight of the project isn't in the model but in the measurement. Every decision in the pipeline (PDF reader, chunking, embedding model, reranker, prompt, LLM) was made as a logged experiment changing a single parameter. There are 52 experiments so far; rejected ones stay in the log too.

## What does it do?

The university's regulations are spread across more than a hundred PDFs. The answer to a question like "How many classes can I miss?", "What GPA do I need for a transfer?" or "When are the spring finals?" is written in an article of one of them, but you need to know which one. On top of that, the same topic can be regulated differently in different faculties: the attendance requirement is 70% in the general regulation and 75% in the Faculty of Medicine.

The chatbot takes these questions as the student writes them and builds the answer from the relevant article:

- **Cited answers.** Every piece of information in the answer has a small citation number, and a numbered source list appears below. Clicking a source opens the full text of the article in a side panel; if the citation carries a paragraph number, that paragraph is highlighted. From the panel you can go to the relevant page of the PDF.
- **Abstaining.** On topics not in the documents (cafeteria prices, the campus address) it says "I don't have information". On the validation set it behaved correctly on all 15 such questions.
- **Follow-up questions.** A question like "So what's the deadline for that?" is turned into a self-contained question using the chat history and searched that way.
- **Rules that vary by faculty.** If a rule varies by faculty and the student hasn't said which faculty they're in, it gives the general rule and asks "Which faculty are you in?"

![Chat screen: numbered citations in the answer and the article panel that opens on click](/img/mevzuat-rag/sohbet.png)

Next to the chat screen there's a page for browsing documents and their chunks, and a password-protected admin panel for labelling users' questions and answers as right or wrong. For a while the interface was open to my friends through Cloudflare Tunnel; those real questions surfaced most of the early bugs.

## Technical details

### Documents and chunking

PDFs are read with `pdfplumber`. Since the natural unit of regulations is the article, I use **structural chunking** instead of fixed-size splitting: each article is one chunk. Articles over 1,500 characters are split at paragraph boundaries, and in the academic calendar each table becomes a chunk. Computer Engineering's course schedule and staff list come as JSON; there each course and each person is a separate chunk. Each chunk starts with a label like `BAİBÜ Transfer Directive - Article 8 (Inter-institutional transfer)` and carries document, article and page metadata for citations.

This decision was the first big win. The fixed-size splitting in the prototype cut some articles in two; after moving to structural splitting, the right chunk started reaching the LLM on every question (EXP-002: context hit rate 0.78 → 1.00).

The article regex grew over time, because the documents aren't written in a single format: there are variations like `Madde 4.`, `MADDE 7 (Değişik...)`, `MADDE 17/A-`, and `MADDE1 2-` with a footnote digit stuck to it in the PDF. The few documents with no article structure are split over the full text.

Chunks are embedded with `BAAI/bge-m3` and written to FAISS. The index's name is a **fingerprint** made from the hash of everything that affects it: the document set, the chunking method, the embedding model and `ingest.py` itself. That way each experiment builds exactly the index it defines. Thanks to a per-document cache, only changed documents are reprocessed; a warm build went from 316 seconds to 0.2 seconds.

Building the corpus also needed data cleaning. Copies with the same hash were easy to find, but there were 8 more pairs whose text was 94–100% identical with different hashes; these showed the same article twice in the context. Removing them brought duplicate repetitions in the context from 31 to 0.

### Retrieval

The question is searched two ways:

- **Vector search** (bge-m3, top 30 candidates) captures semantic similarity: "leaving school" and "withdrawing enrolment" are different words, but their vectors are close.
- **BM25** (top 30 candidates) captures word matches: article numbers, terms like "AKTS" (ECTS) or "GNO" (GPA). Since Turkish is an agglutinative language, the first 5 letters of each word are taken; "ortalamam", "ortalaması" and "ortalamasının" (forms of "average") all become `ortal`.

The two lists are merged with **Reciprocal Rank Fusion**. Each chunk gets `1 / (60 + rank)` points for its rank in each list, and the points are summed. The reason for summing ranks rather than scores is that cosine similarity is between 0 and 1, while BM25 scores are unbounded.

The merged candidates go to a **cross-encoder reranker** (`BAAI/bge-reranker-v2-m3`). The embedding model turns the question and the chunk into vectors separately; the reranker reads them together and gives a relevance score. Slower, but much more precise. The top 5 chunks are given to the LLM as context.

When the corpus grew from 3 documents to the full set of regulations, the reranker did the real work. Similar regulations from other faculties came in as distractors, and vector search's MRR@10 dropped from 0.94 to 0.60. The reranker lifted the ranking from 0.59 after RRF to 0.86 (EXP-015). The number of candidates sent to the reranker mattered too: it was 8 at first, and when the right chunk landed 9th in RRF the reranker never saw it. Raising it to 30 removed that bottleneck (EXP-021). Running the reranker in fp16 left the ranking exactly the same and cut its time from 1,372 ms to 363 ms (EXP-022). On the GPU (RTX 4050, 6 GB) the whole retrieval takes about 400 ms; in the prototype it was 5.4 seconds on CPU.

### Answer generation

Gemini 3.1 flash-lite writes the answer. My reason is practical: the API gives 500 free requests a day, and each experiment takes 100–200 requests. I also measured the newer 3.5 flash-lite (EXP-035); accuracy came out the same semantically, while LLM time went from 4 seconds to 14.5 seconds, so 3.1 stayed.

The system prompt tells the model to use only the information in the context, to cite every piece of information as `[Document, Article N]`, and to say "I don't have information" if there's no answer. For follow-up questions, a separate LLM call first turns the question into a standalone one (query rewriting), and retrieval is done with that.

What I worked on most was rules that vary by faculty. For a question with no faculty specified there were two options: fetch and list every faculty's rule, or give the general rule and ask for the faculty. I chose the second, because once the student named their faculty the system already found the right article well (16 of 17 questions). And someone asking from their phone doesn't want to read a list of five faculties.

I first left the decision to ask about the faculty to the LLM via the prompt; the model asked for the faculty unnecessarily on 45% of questions (EXP-025). Then I moved the decision into code: each document's scope is tagged in a JSON file (general, medicine, dentistry, law, graduate, associate degree...). If the context has documents from at least two different parallel scopes and the question doesn't name a faculty, the clarification prompt kicks in (EXP-027). When I also rewrote the main prompt as "first identify the documents containing the answer; ask if the answer is in both the general document and a separate faculty document", the unnecessary-asking rate fell to 0.28 (EXP-037). It still asks more often than it should, but I accepted that knowingly: the cost of not asking is a student relying on the wrong rule; the cost of asking too much is one message.

Some cases never reach the LLM. The summer school regulation was repealed, but old references to it remain in 19 documents and the model was building outdated answers from them. If the question is about summer school, a fixed answer is returned without retrieval. There's a similar rule for internship durations: if the unit isn't specified, it asks for the unit first. Gemini sometimes blocks an answer for copying the source and returns empty (RECITATION); in that case the request is retried once with a "write it in your own words" note.

### Application

The backend is FastAPI. The layers are separate: interface → `api.py` → `service.py` (logging, rate limiting) → `rag.py` (the RAG core). The API is stateless; chat history is kept on the client and sent with each request. Models are loaded once when the server starts.

I tried Gradio first, but making citations clickable and opening the article panel didn't fit its component model. I rewrote the interface in vanilla HTML, CSS and JavaScript. The LLM answer goes through DOMPurify, the PDF endpoint only serves files in the corpus (against path traversal), and the admin panel is protected with HTTP Basic Auth. Since there's an API with a daily quota behind it, `/ask` has per-person and server-wide rate limits. Chat logs are written as JSONL and don't go into the repo.

### Evaluation

Every change is an experiment defined in an `experiments/configs/EXP-XXX.json` file. It differs from its parent experiment in a single parameter; the reason, hypothesis and expected direction are written before the experiment runs. The result file stores the commit hash the experiment ran on. Whether a change is due to chance is checked with paired tests on the same questions (McNemar, Wilcoxon).

I saw on the first day why the single-variable rule matters. Normalising embeddings made results worse with MiniLM (EXP-003), while switching the embedding model to bge-m3 improved them a lot (EXP-004, MRR@10 0.65 → 0.92). Had I done both at once, I'd have seen an overall improvement and never noticed the harm from normalisation.

Retrieval measurement is evidence-based: next to every question there's an evidence sentence that appears verbatim in the source, and a chunk counts as relevant only if it contains that sentence. My first metric checked "did the right article number come back?"; since the prototype's chunks had no article numbers, it showed everything as correct. Measuring with evidence revealed that in the prototype, for 5 of 27 questions the right chunk wasn't even in the top 10. Each stage of the pipeline (vector, BM25, RRF, reranker) is measured separately; that way you can tell whether an error comes from the right chunk never entering the candidate list or from it ranking too low.

For answer correctness, keyword matching is only a first pass, because it's misleading in Turkish: an answer saying "karşılanmamaktadır" misses the expected "karşılanmaz" (both mean "is not covered"), and the answer "kesilmez" ("is not cut") wrongly matches the expected "kesil" ("is cut"). The real measure is semantic correctness: I read the answers question by question, and the reasoning for every judgement is in the repo.

There are three question sets, like a train/validation/test split:

| Set | Purpose | Size |
|---|---|---|
| Dev | Prompt, threshold and retrieval decisions | 113–219 questions (versioned) |
| Validation | Only to validate the production candidate | 111 questions |
| Locked test | Once, at the very end | 115 questions |

Question sets are never changed; when a change is needed a new version is created, because changing the set invalidates comparisons with old results. Each question carries a type (in the document's terms, in student wording, multiple articles, not in the documents, off topic, with typos, clarification, follow-up, false premise) and results are reported per type.

The current system is 94% semantically correct on the dev set and 88% on the validation set. The gap comes from fitting to the dev set: I made decisions looking at the dev set, so the realistic number is validation.

### Tried and not adopted

The experiments that weren't adopted taught as much as the ones that were:

- **Removing BM25.** BM25 couldn't be shown to contribute significantly on its own (EXP-007, EXP-031), but I kept it for article numbers and abbreviations. No latency difference.
- **A Turkish stemmer.** The Snowball Turkish stemmer made BM25 worse (EXP-049): it shortens question words too much; "yüzde" (percent) becomes "yüz" (hundred / face).
- **Official document names.** Putting the official document name instead of the file name in the chunk header dropped MRR@10 from 0.830 to 0.814 (EXP-042): headers mentioning a faculty name pushed faculty regulations ahead on general questions.
- **Searching missing faculties separately.** Separately searching for and adding faculty regulations missing from the context (EXP-026) triggered on 43% of questions, made the context 21% longer, and fixed only 2 questions.
- **Query decomposition.** Splitting multi-part questions into sub-questions with an LLM and searching each raised context hit rate from 0.871 to 0.903, but semantic accuracy fell from 0.94 to 0.92 (EXP-052). More right chunks came in, but the context got noisier.

### Known weaknesses

Of the 21 wrong answers on the validation set, 19 are retrieval problems and 2 are the model's reasoning.

- **Questions asking two things in one message** (7/12). "If I change my internship place, how many days before must I tell them, and when do I hand in the report?" Since the question is turned into a single embedding, the second article's chunk doesn't make it into the context.
- **Rules that vary by faculty** (9/12). If the general regulation writes the rule as a table or with a different term, the reranker pushes it below a faculty regulation that writes the same rule as a sentence.
- **Questions written without Turkish characters** (8/10). For questions like "hazirlikta derslerin yuzde kacina" the right chunk can't get into the candidate list. Character folding in BM25 (ı→i, ü→u) moves the right chunk from 47th to 8th in RRF, but the reranker still pushes it out of the top 5 (EXP-050). The bottleneck is now the reranker.
- **Implicit inference.** The directive says "the scholarship of anyone receiving a disciplinary penalty other than a warning is cut", and a student asks "I got a reprimand, will my scholarship be cut?" Even with the right article in the context, the model can't infer that a reprimand falls under this.

The locked test set hasn't been run yet; it will be run once when all tuning is done.

I built a tool-calling version on top of the same regulations as a separate project: [agentic-rag](/en/projects/agentic-rag/). There, this pipeline is one of the agent's tools.
