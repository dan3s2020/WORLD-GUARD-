# Ride mode, visual decisions and globes — verbatim (2026-10-27)

## User — visual decisions

```text
I love it. It's great but we should keep it intact and add some plans to do some new things .

So the main down is that we need to make this into something animated ,visually intelligible the task for the user. And actually see in the world the animation of what happened after his decision . And have "simplified" button that turns this lists of answers into explained animations ,like a grid of 4 squares animation buttons that users can select to set the answer. Because the button shows how will the task be done . And on the up side where is the text with the situation ,the situation should stil have this text ,but be visually represented somehow . So you makr for everything or you find an universal representation that any type of user can understand no matter his knowledge
```

## User — ride an agent, globes of 20 players

```text
I think users should be able to ride an agent or swarm to complete tasks and actually play on this earth ,so we will make separate servers/simulations for each 20 players and they will contribute to the main simulation data,so it's like having all users do tasks and etc ina simulation but we let them experience this simulation only 20 in each 3d globe. And it's like WormsZone.io but it's not making a worm game,no ,that's stupid . It's like instead  of the worms in that 2d world ,we ride ( so focus keeps the screen above the "Worm") but instead od the worm we ride an agents that is doing tasks ,and we are his steering wheel when he needs,this way we can visually see the problem . And you do this while around the globe or in a certain city etc. And when you are done with that agent you can select another ones that need assistance ,and it animates the zoom out from the view of that agent you just finished and then when the earth is zoomed out ,you select another agent from the list and follow him while he does his jobs. So make it cute,and something that can grow in complexity ,it's like a game 3d . Do it right . Maybe subway surfers has the good angle for this but not in 100% the game ,just a part of it resembles something ,something like subway surfers game and WormsZone.io game combined or having a baby.
```

## User

```text
Continua
```

## Implementation notes (not verbatim)

- Universal picture language: every task uses the same 7 actions and one of 8 sectors, so one pictogram grammar covers all of them (`site/game/scene.js`, gallery at `tests/visual/scenes.html`).
- Ride mode reuses deterministic Route Guard districts, so every ride is scored by the server and stored in the open dataset.
- Status: `docs/REQUIREMENTS_CHECKLIST.json` WG-081 … WG-085.
