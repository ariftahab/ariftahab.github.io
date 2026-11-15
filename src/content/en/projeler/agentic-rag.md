---
title: agentic-rag
summary: The agent version of the same architecture, deciding for itself when to search.
lead: An agentic RAG chatbot derived from the mevzuat-rag architecture, focused on advising questions from Faculty of Engineering students.
year: 2026
stack: [agent, claude haiku, code execution, mutation testing]
order: 2
github: https://github.com/ariftahab/agentic-rag

diagram:
  cols: 5
  caption: decisions in the LLM, arithmetic in code; the agent picks which of 15 tools to call, the tools compute the numbers, and if none fits it writes code in a sandbox
  groups:
    - { label: some of the tools, cols: [3, 4], rows: [0, 2] }
  nodes:
    - { id: q, label: question, sub: + transcript, col: 0, row: 1 }
    - { id: agent, label: agent, sub: Claude Haiku · picks tools, col: 1, row: 1, hl: true }
    - { id: ans, label: answer, sub: with sources, col: 1, row: 2 }
    - { id: regs, label: search_regulations, sub: mevzuat-rag search, col: 3, row: 0, span: 2 }
    - { id: trans, label: analyze_transcript, sub: missing courses · ECTS · GPA, col: 3, row: 1, span: 2 }
    - { id: sim, label: code_execution, sub: isolated sandbox, col: 3, row: 2, span: 2 }
  edges:
    - { from: q, to: agent }
    - { from: agent, to: regs, both: true }
    - { from: agent, to: trans, both: true, label: call / result }
    - { from: agent, to: sim, both: true }
    - { from: agent, to: ans }
---

## Summary

agentic-rag is a tool-calling LLM agent for Faculty of Engineering students and their academic advisors. It searches the regulations, reads the student's transcript, does graduation and grade calculations in code, checks the course schedule for section clashes, and shows the source of every piece of information. It uses [mevzuat-rag](/en/projects/mevzuat-rag/)'s retrieval pipeline as one of its tools.

I wrote the agent loop by hand with the Anthropic SDK, without a framework. The model is Claude Haiku; it has 15 tools, and for calculations none of the tools can handle, it writes Python and runs it in Anthropic's isolated sandbox. On a 110-question validation set I never used for tuning, 107 answers are semantically correct, and it followed its instructions in all 10 prompt injection attempts.

## What does it do?

While building mevzuat-rag I noticed some questions weren't retrieval problems. The answer to "What am I missing to graduate?" isn't written in any article. The student's transcript, the department's curriculum and the regulation's graduation rule have to be put side by side and computed. In classic RAG every question takes the same path: search, give the top 5 chunks to the model, generate an answer. These questions can't be solved that way.

Questions the agent gets look like this:

- "When is the deadline for my internship application?" From the regulations, with article citations.
- "What am I missing to graduate?" Computed from the uploaded transcript, the curriculum and the regulation's rules.
- "If I get 70 in these three courses this term, what will my GPA be?" Grade simulation.
- "If I take section B, what does it clash with, and can I keep Friday free?" Course schedule and section plan.
- "Who is the head of the Computer Hardware division?" Academic staff data.
- "Is there an announcement from the department this week?" An announcement store scraped every night.

Students can upload the transcript PDF they download from the university system into the chat. The interface shows which tools the agent called and the sources of the answer; clicking a citation opens the relevant article. The system gives rules and "what happens if I do this" calculations, and leaves the decision to the advisor.

## Technical details

### Documents

The project started from a snapshot of mevzuat-rag, but the goal was different: instead of a Q&A bot, an agent that does an academic advisor's job. I narrowed the corpus in two rounds. First the documents that don't apply to Engineering students went (129 → 58), then the ones that don't help with advising (58 → 24 documents, 685 chunks). What's left are undergraduate and graduate regulations, internship, transfer, course equivalence, double major, minor, the academic calendar and similar documents.

In a single-faculty corpus, mevzuat-rag's mechanisms for asking which faculty (the clarification trigger, scope tags, the "which unit?" answer for internships) only caused unnecessary questions, so I removed them all. Structured data was added next to the documents: the Computer Engineering curriculum (40 required courses and elective slots), the course schedule, the academic staff list and an announcement store in SQLite.

### Agent loop

The loop is simple: on each turn the model either calls a tool or writes the answer. Tool results are fed back as messages. The number of turns is capped so the model can't keep asking for tools forever. The system prompt and tool definitions are kept in the cache with prompt caching.

I wrote the loop by hand instead of using a framework like LangGraph because the needs are small. There's one agent, one model and a stateless API. Server-side state, interruptible and resumable flows and multi-agent setups that a framework brings aren't needed here. Server-side code execution, uploading files to the sandbox and prompt caching were easier to write directly with the SDK; every turn and tool call is logged in my own code. I wrote the decision, and when to revisit it, in an ADR.

### Decisions in the model, arithmetic in code

This is the rule at the centre of the design. Summing ECTS, matching courses to the curriculum, computing GPA and finding section clashes are done in deterministic Python. The model only chooses which tool to call and puts the result into sentences; it passes numbers through from the tool output as they are.

The main ones among the 15 tools:

- `search_regulations`: mevzuat-rag's hybrid retrieval and reranker pipeline.
- `list_articles`, `get_article`: browse a document's articles, follow a cited article.
- `analyze_transcript`: compares the transcript with the curriculum and produces completed ECTS, missing required courses and the elective gap.
- `simulate_grades`, `simulate_courses`: "if I get these grades" and "if I take these courses" calculations.
- One tool each for graduation requirements, the course schedule, offered electives, announcements and staff.

Graduation rules are also stored as data, and each rule carries an article reference: 240 ECTS (Article 22/1), GPA at least 2.00, whether an out-of-field elective is required depending on the enrolment year. Only rules written in the regulations go into the rule data. For a while the 244 ECTS from the curriculum was in there too; I removed it because the regulation says 240.

The format of the tool output turned out to matter too. `analyze_transcript` originally returned a full 10,700-character JSON report. The important number ("if you pass this term's courses you'll have 187 ECTS") sat in an unlabelled field among information the question didn't need; the model mentioned it in only 1 of 5 tries. When I gave it a short summary generated in code from the same calculation, putting the two scenarios first, it mentioned it 5 out of 5 times, and input tokens dropped from 5,939 to 2,461.

### Personal data

The transcript isn't a tool argument. Once uploaded it sits in server memory in a closure; `analyze_transcript` reads it itself and only the evaluation report goes to the model. The student's name, student number and national ID number never enter the parser output; they don't go to the LLM, to disk, to logs or to git. That's why the upload uses a raw PDF body instead of multipart: FastAPI writes multipart files over 1 MB to a temporary file, which would break the "nothing is written to disk" rule. The API is stateless; history and the transcript stay on the client.

### Code execution

For a calculation no tool covers ("What's the total ECTS of the courses I got AA in?", "How many hours of class does 3rd year have per week?") the model writes Python. The code runs not on this machine but in Anthropic's server-side sandbox: a new container per question, no internet, only the files uploaded in that request are visible. I tested this separately: in seven attempts the sandbox couldn't reach the internet, none of our secrets were there, no files carried over between questions, and instructions embedded in files weren't followed. So I didn't set up Docker separately.

In the first version the model explored the files before every question (`ls`, `head`); once I gave it the file schema along with the task, the exploration turns disappeared and time went from 97 seconds to 24–30 seconds. Generated code is written to the log. I found frequently repeated ones in the log and turned them into permanent tools; the number of questions that ran code dropped from 9 to 1, with the same answers (EXP-015).

### Model

The agent was originally on Gemini, with a separate Haiku call for the code-writing part. Model choice turned out to be critical: going from Gemini 3.5 flash-lite down to 3.1 flash-lite dropped answer accuracy from 0.88 to 0.68 (p = 0.003) and made it 4 times slower. The two-model setup had unnecessary hand-offs and losses in GPA calculations. Moving to a single model, Claude Haiku, removed those (EXP-010). Prompt caching cut the cost per evaluation run from $0.27 to $0.12.

### Announcements

Announcements don't go into the corpus; they live in a separate store. A scraper crawls the university's general, faculty and department announcement pages; Haiku writes a summary of each announcement, code adds the links, everything is written to SQLite and searched with BM25. Small but important bugs showed up while parsing: an HTML fragment like `<strong>5</strong>00 TL` was read as "5 TL". Experiments use a fixed snapshot and a fixed "today" date instead of the live store, otherwise results would change from day to day.

### Evaluation

The experiment setup from mevzuat-rag came over as is: each change is a config differing from its parent experiment in one thing, a hypothesis written beforehand, the commit hash, and paired tests. For the agent the metrics grew: semantic correctness of the answer, whether the required tool was called, calculation correctness, and time.

The first question sets were written while the system was being built, mostly based on bugs I'd found; the 96% accuracy there partly meant "I fixed the system for those questions". So I wrote two new sets. I never ran the system while writing them; questions, answers and evidence came from the raw text of the PDFs. I computed the transcript numbers separately, independent of the system's code, using the coefficient table in the regulation.

| Set | Purpose | Size |
|---|---|---|
| Dev | Prompt and tool experiments | 53 questions |
| Validation | Measurement only | 110 questions, 8 categories |

Validation categories: single fact, unit distinction, conditions and exceptions, cross-references, combination, dates, abstaining, and prompt injection (7 direct, 3 indirect attempts embedded in files).

What worked:

- **Announcement and staff tools.** It answered 1 of 15 new questions on these topics correctly; with the tools, 13–14. Overall accuracy 0.83 → 0.96 (p < 0.05). The right tool was more effective than adding rules to the prompt.
- **Article navigation tools, document level and a conflict rule.** When two documents on the same topic conflict (like a national higher-education regulation and a university directive), the agent picks the one in force by looking at document level and date. On validation it went from 100/110 to 107/110 (EXP-021); the cost is 39% more time per question.
- **Mutation testing.** I tested the graduation calculation's tests with cosmic-ray: in `graduation.py`, 137 of 658 mutants survived at first; with new tests that went down to 55. The rest are equivalent mutants. The new tests caught gaps like ordering of the summer term, electives with more or fewer ECTS than their slot, and the boundary value of total ECTS. There are 345 tests now.

The most instructive experiment that didn't work was a reflection loop (EXP-018). A separate Haiku call reviewed each draft answer, and if it found something missing, the agent continued. Accuracy dropped from 43/53 to 41/53 and it took 3 times as long. The reviewer called the first draft "incomplete" on 36 of 53 questions; it made correct, definite answers hesitant ("internship pay is 30%" turned into "there are two rates"). The root cause was that the reviewer couldn't see what the agent knew: today's date, the student's department, whether a transcript was uploaded. It treated those as made up.

### Known weaknesses

- **Combination questions** are the weakest type. When a question needs two sources (transcript and a rule, the schedule and a directive) the agent sometimes doesn't search the rule side at all. For "Which of my courses this term are common required courses?" it only looked at the transcript report and counted the 8 required courses in the curriculum; the right answer is the 3 common required courses in the regulation.
- **Unnecessary tool calls.** Not counted as errors, but they add time; 10–15 seconds per question.
- **Scope.** There are 24 documents and one department's curriculum and course schedule. The schedule has no instructor information, so "who teaches this course?" can't be answered.
