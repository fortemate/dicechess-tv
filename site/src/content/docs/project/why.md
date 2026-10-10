---
title: Why Dice Chess on TV
description: 'Chess in which three dice choose the pieces each turn: luck gives a newcomer a real chance, so a family can play one game together at the television.'
sidebar:
  order: 1
---

## Chess splits a family by skill

In ordinary chess the stronger player wins nearly every game. A parent who plays well and a child who is learning cannot really play each other: one of them is bored, and the other keeps losing.

## Dice level the board

Dice Chess keeps the chess pieces and the way they move, and adds three dice. Each die names a piece: pawn, knight, bishop, rook, queen or king. A turn is up to three actions, one per die, with the pieces the dice allow, and a player must use as many dice as the position allows. There is no check and no checkmate: a game is won by taking the king. These are the rules of Fortemate's engine, and the app's tests check its rules guide against the engine.

Skill still matters. A player chooses among the moves the dice allow, and keeps the king out of reach of the rolls to come. But luck gives a newcomer a real chance of winning, so a game between players of very different strength stays a game.

## One television, one remote

The living room is where a family is already together. In a game against a friend two players pass one remote, turn by turn. A person alone can play one of three computer opponents. Nothing needs an account, and the app's source contains no network calls. All of this was played on the Vega Virtual Device. Since 6 October 2026 the game has also run on a Fire TV Stick 4K Select, where it has been played with the Stick's own remote ([Performance](/technology/performance/#response-to-the-remote)).

## What existed before, and what is new

Fortemate built the rules first: the open-source Dice Chess engine, [`@fortemate/dicechess-engine`](https://github.com/fortemate/dicechess-engine), and a [web game](https://fortemate.com/) on top of it.

This Fire TV app is new. Its repository started on 21 September 2026, during [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), and it was written for the television:

- the board and its remote navigation;
- the menus;
- the tutorial and the rules guide;
- sound;
- saving;
- the computer opponents' turns, shown one action at a time, with each piece sliding to its square.

Version 1.0.0 was released on GitHub on 10 October 2026 and submitted to the Amazon Appstore, where it awaits Amazon's review ([Get the game](/play/beta/)).

It takes the rules from the engine's npm package, so the TV app and the web game play by the same rules.

[What it does](/project/features/) shows each feature on the screen.
