---
title: rl-finetune-lab
summary: Experiments with a small model to see how fine-tuning actually works.
lead: A learning project where I tried SFT, DPO and GRPO with a small model on my own computer, to experiment with local models and understand how fine-tuning really works.
year: 2026
stack: [sft, dpo, grpo, transformers]
order: 5
---

## Summary

rl-finetune-lab is a series of experiments I ran to understand how fine-tuning actually works. On a 6 GB laptop GPU I trained a small language model (Qwen3.5-2B, 4-bit) with three methods: SFT, DPO, and GRPO, an RL method. I compared them all from the same starting point, with the same data, on an exam the model never saw during training.

The short version: when I had the correct answers, the simplest method, SFT, gave the fastest and best result. GRPO, on a task where the correct answer couldn't be written down and only the outcome could be measured, did something interesting: without anyone telling it, purely from cost, it learned that stopping the rig because of a faulty sensor was unnecessary.

## What does it do?

This isn't a product, it's a learning project. My goal was to compare an untrained model with a trained model on the same exam, and see with my own eyes what methods like SFT and DPO are for and how data is fed to the model.

For that I first needed answers to these questions: What will I teach the model? How will I know it learned? Will this run on this computer?

The first task suggestion was a calendar task; I rejected it, because an ordinary local model could already do it. If a model already knows a task, the effect of training doesn't show. The task had three requirements: the model couldn't know it beforehand, I'd know the correct answer for certain, and it would resemble a real engineering problem.

## Technical details

### The task: an imaginary hydraulic test rig

A small simulator produces the sensor log of an imaginary hydraulic rig: pressure, flow, temperature and vibration over a few time steps. The model looks at this log and states three things:

```text
Tezgah hatti: A
t=0  | basinc 203 bar | debi 41 L/dk   | sicaklik 60 C | titresim 2.06 mm/s
...
t=25 | basinc 203 bar | debi 36.6 L/dk | sicaklik 60 C | titresim 2.28 mm/s

Beklenen: {"ariza": "kavitasyon", "bilesen": "pompa_1", "aksiyon": "izle"}
```

(The task itself is in Turkish: rig line A, pressure, flow, temperature, vibration; expected fault "cavitation", component "pump_1", action "monitor".)

Flow is dropping, vibration is rising. By the rule I made up, that's cavitation; since it's on line A the component is `pompa_1`; since the change is small the decision is `izle` (monitor). Because I made up the rules, there's no way the model could know them. The simulator verifies every log it produces by solving it again with the rules, so every question is known to be actually solvable.

### Measurement

Before training I prepared a fixed 240-question exam: 120 basic, 120 hard. An answer counts as fully correct if all three fields are right. The exam is never used in training. Random guessing scores 0.3%, a program that knows the rules scores 100%; the model should land somewhere in between.

I also measured whether writing the rules into the prompt is enough, because if it is, there's no need to train:

| Fully correct (basic / hard) | 0.8B | 2B | 4B |
|---|---|---|---|
| No rules | 0.8% / 0% | 1.7% / 3.3% | 13.3% / 8.3% |
| Rules in the prompt | 12.5% / 12.5% | 5.8% / 5.8% | 19.2% / 12.5% |

Even with the rules spelled out, small models can't solve it. 0.8B's 12.5% is misleading too: the model answered "normal" to almost every question, and since one in eight cases is normal, that makes 12.5%. You have to look at what the model is doing, not just glance at the average score.

### Hardware

I have a 6 GB RTX 4050. 0.8B was fast but very weak; 4B was the best but didn't look like it would fit for training. I used the 2B in the middle with 4-bit quantization.

Generation speed was low on Windows. The acceleration package the model uses (`flash-linear-attention`) didn't kick in on Windows; using the same card through WSL, 0.8B at batch size 4 went from 79–86 tokens per second to 125–137. Same hardware; only the software environment changed.

Training memory was a bigger problem. On 2B even batch size 1 needed 7.81 GB, and the card has 6 GB. Instead of guessing, I changed one thing at a time and measured:

| Change | Step time | Reserved memory |
|---|---|---|
| None | 1.35 s | 7.32 GB |
| 32-bit upcast off | 0.79 s | 7.01 GB |
| + Vision part removed | 0.58 s | 6.91 GB |
| + `expandable_segments` | 0.48 s | **3.88 GB** |

The last row was the most surprising. The model didn't actually use less memory; the space PyTorch reserved and left empty shrank. Training fit in the card's memory and got about 3 times faster.

### SFT

In SFT you show the model the question and the correct answer. Data goes into the model as tokens, and an input and a label are prepared for each token. The question's tokens get the label `-100`, meaning "don't score this". That way the model doesn't memorise the question; it only learns to produce the answer. In the example, the log is 461 tokens of question and 29 tokens of answer.

Almost the whole model was frozen; LoRA adapters were attached and only they were trained (about 0.8% of the parameters). Since LoRA has no effect at first, I re-ran the exam right before training and got exactly the old score. That was a good check that the exam setup worked correctly.

Training with 1,008 examples took 9.8 minutes and the result went from 2.5% to **100%**. My guess had been 15–30%. Seeing 100%, I first looked for a bug: did the answer leak into the question (no), do training and exam logs overlap (0 shared logs), does the model get the same score after being saved and reloaded (yes), what does it do on 480 new questions (100% on basic, 98.3% on hard).

Then I pushed the model with data different from training. When the sensors' baseline values changed, fully correct dropped to 77.5%, and most errors were in the action field. A likely interpretation: instead of computing the percentage change, the model takes a shortcut based on the baseline values it saw in training. I didn't test this separately, but it showed that "100%" really means "100% on this kind of data".

### Less data

Once SFT solved the task, the exam hit the ceiling. If one method scores 100% you can't see a rival that's better. So I cut the data down to 208 examples. This time SFT scored 24.6%: 100% on the fault field, 52.5% on component, 38.8% on action. The model learned the easy part first; action stayed close to random guessing (33%). That's where the other methods had room to improve.

### DPO

In DPO, instead of the correct answer, you give "this answer is better than that one". I produced the bad answer by corrupting one field of the correct answer (`hemen_durdur`, "stop immediately", instead of `izle`, for example). At the start the preference hasn't changed, so the DPO loss is always 0.693; that value was the first thing I used to check the code was right.

The first attempt scored 0%. The model wasn't even writing JSON anymore; it repeated "Pompası Pompası Pompası...". Yet the loss was falling. Looking at the probabilities showed why: the good answer's log-probability had dropped from -14 to -160, the bad answer's from -11 to -167. Both answers had become nearly impossible, but the good one was slightly more likely than the bad one. Since DPO only looks at that difference, it was satisfied. Only after cutting the learning rate tenfold did valid JSON return to 100%, with 7.1% fully correct. The model can break while the loss looks good; you have to look at the actual output the model produces.

### A control experiment

Adding DPO on top of the SFT model rather than from scratch is a common approach. I tried it and the result went from 24.6% to 35.0%. Had I stopped here, I'd have said "DPO worked". But the model was seeing the same questions a second time; the improvement could come from that alone. So I did one more round of SFT on the same model with the same data:

| From the same start (24.6%) | Fully correct | Time |
|---|---|---|
| One more round of SFT (control) | **46.2%** | 2.5 min |
| GRPO | 37.1% | 14.6 min |
| DPO | 35.0% | 6.0 min |

The simplest alternative was the best. Without the control I wouldn't have known. The right question isn't "did the score go up?" but "did it go up compared to the simplest alternative?".

### GRPO

In GRPO the model is never shown the correct answer. The model produces four answers to the same question, a rule scores each one (1/3 for each correct field, 0 for invalid JSON), and the model learns to write the answers that score above the group average more often. What matters isn't the score itself but where it stands relative to the other answers in the group. If all four answers get the same score, nothing is learned from that question.

Without ever seeing the correct answer, GRPO went from 38.8% to 67.0% on the action field. The method works, but it's no surprise that SFT is better when I have the correct answer. The 2-point gap between GRPO and DPO is also too small to interpret from a single run. I noticed one more thing: the scores of the answers sampled during training didn't rise noticeably, but the exam score did. The criterion "if the score isn't rising, it isn't learning" was wrong.

### A task with no single correct answer

So far I had tested GRPO where SFT is strongest. RL's real promise is tasks where you can't write the correct answer but can measure the outcome. So I changed the task. The model makes only one decision: `izle` (monitor), `planli_bakim` (scheduled maintenance) or `hemen_durdur` (stop immediately). Each decision has a cost coming from a hidden formula. I also added an "operator rule": it only looks at the size of the change; not bad, but flawed. For example, it also stops the rig when a sensor breaks and shows a wrong value. I have past operator decisions and a system that measures cost, but no list of "best decisions".

| Who decides? (480 new logs) | Cost |
|---|---|
| Best decisions computed from the formula | 2.25 |
| SFT on best decisions (not available in reality) | 2.46 |
| **GRPO** | **2.55** |
| Operator | 2.57 |
| SFT on operator decisions | 2.58 |

The gap between GRPO and the operator is 0.022, and the 95% confidence interval includes zero. So I can't say GRPO beat the operator. What was really interesting was behind the average:

| | Operator | GRPO |
|---|---|---|
| Loss on sensor faults | 1.43 | **0.00** |
| Loss on external leaks | 0.02 | 0.45 |
| Use of `planli_bakim` | 31.2% | **1.2%** |

GRPO learned that stopping when a sensor breaks is unnecessary, without ever being told, purely from cost. The SFT model imitating the operator copied that mistake exactly. That's exactly RL's promise. But the model nearly abandoned the `planli_bakim` decision, even though 35% of the best decisions are that. A likely cause is the model becoming confident in its decisions too early: in 80–92% of groups all four answers got the same score, meaning the model learned nothing from those questions. In RL this is called the exploration problem; I haven't tested this yet. RL's strength and its risk come from the same place: the model learns things from the reward that I never said.

### Lessons

1. Set up measurement first. Without a baseline and an unseen exam, training results are meaningless.
2. If you have correct answers, try SFT first.
3. Don't trust the loss; look at the output.
4. Be as suspicious of a very good result as of a bad one.
5. Always include a control. A method that can't beat the simplest alternative hasn't proven its value.
6. Change one thing at a time. That's how the memory and DPO problems got solved.
7. Use RL where you can't write the correct answer but can measure the outcome; its success depends on how well you set up the reward and exploration.

One caveat: these results come from a single task, and most experiments were run once, with a single random seed. They shouldn't be turned into a general rule like "SFT always wins". Next up is re-running GRPO with more exploration and repeating the experiments with different seeds.
