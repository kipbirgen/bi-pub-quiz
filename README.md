# BI Pub Quiz

A live, Qlik-inspired pub quiz for 2–8 players on separate devices. One player hosts and plays. The other players enter the same room code or open the invitation link.

## Play locally

Requires Node.js 22 or newer. There are no third-party runtime dependencies.

```sh
npm start
```

Open http://localhost:3000 to host. For devices on the same network, open the host computer's LAN address on port 3000 (for example, http://192.168.1.20:3000). Have the host open the app at that same shared address before copying an invite link.

## Rules

1. Each game draws five questions each from BI Basics, Read the Chart, and Data & Qlik, without repeats. Question and answer order are shuffled within each round.
2. Everyone gets 25 seconds to lock one private answer. The server closes the question sooner if everyone answers.
3. Each correct answer earns 100 points. Incorrect and unanswered questions score zero, with no speed bonus.
4. After each question, everyone sees the answer and explanation. The leaderboard appears after each round. The host advances from the reveal and leaderboard screens.
5. After 15 questions, the highest score wins. Players tied for first get 25 seconds to enter an estimate. The closest guess wins. Equal closest guesses share the win. If nobody submits, everyone tied for first shares the win.

## Question bank

The server loads 74 multiple-choice questions and 10 numerical tiebreakers from `questions.mjs`. Add to the relevant round to expand the bank. Each multiple-choice question needs a unique ID, four distinct choices with the correct choice first, and an explanation. Chart questions also need a title, four labels, and four corresponding values. Estimates include a prompt, numeric target and unit.

Qlik references include its [associative selection model](https://help.qlik.com/en-US/sense/November2024/Subsystems/Hub/Content/Sense_Hub/Selections/associative-selection-model.htm), [synthetic keys](https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/LoadData/associating-data.htm), and [set analysis](https://help.qlik.com/en-us/sense/November2023/Subsystems/Hub/Content/Sense_Hub/ChartFunctions/SetAnalysis/set-analysis-expressions.htm). This is an independent quiz.

## Hosting for remote players

Run `npm start` on a Node.js host with HTTPS and share its public address. The server listens on the host's `PORT` environment variable, defaulting to 3000. Use one instance and keep server-sent events enabled without buffering. GitHub can hold the source, while the running quiz requires a Node.js host.

Rooms live in server memory. Players can reconnect from the same browser tab after a temporary network drop or refresh. Server restarts clear rooms, and inactive rooms expire after three hours.

## Verify

```sh
npm test
```
