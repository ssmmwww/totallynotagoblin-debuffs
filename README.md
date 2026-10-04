# Token Condition Badges

A Foundry VTT module for the dnd5e system. Foundry draws status icons at a fixed small size (20 px per 100 px grid square), whatever the token's size, so on a Large or Huge creature they are hard to see. This module draws each condition again as a badge along the bottom edge of the token, sized to the token: about a fifth of its width and never smaller than half a square.

When a condition is applied, its icon and name appear large over the token for about two seconds, then shrink into their badge. Nothing loops afterwards.

Foundry's own small icons stay where they are. Buffs and other effects (Bless, Haste, Hunter's Mark) appear only there; the badges are for conditions.

## Install

In Foundry's Setup screen, open Add-on Modules, click Install Module, paste this manifest URL at the bottom and click Install:

```
https://github.com/ssmmwww/totallynotagoblin-debuffs/releases/latest/download/module.json
```

Then open your world, enable Token Condition Badges in Game Settings > Manage Modules, and have everyone press F5 once.

To install by hand instead, download `module.zip` from the latest release and unzip it into `Data/modules/token-condition-badges/`, then restart Foundry.

## What gets a badge

Unconscious, Petrified, Paralyzed, Stunned, Incapacitated, Restrained, Grappled, Prone, Frightened, Charmed, Blinded, Deafened, Invisible, Poisoned, Exhaustion (with its level) and Concentrating, from left to right in that order.

The border colour shows the kind of condition: orange for movement, yellow for out of action, violet for mind, blue for senses, green for body, teal for concentration. When more conditions are on a token than fit on the arc, the rest are counted in a grey "+N" badge. Incapacitated is not shown separately when Stunned, Paralyzed, Petrified or Unconscious already is. A dead creature shows no badges.

It reads the same effects Foundry draws its own icons from, so conditions applied from the token HUD, Midi-QOL, Chris's Premades, DAE or macros all appear.

## Settings

In Game Settings > Configure Settings > Token Condition Badges:

- Show condition badges (each player, default on)
- Entrance animation (each player, default on)
- Badge for Concentrating (GM, default on)
- Badge size (GM, 0.6 to 1.6, default 1)

## Notes

Each player's browser draws its own badges, so nothing is saved in the world and nothing goes through the network. Badges hide with the token: hidden and invisible tokens hide them from players as they hide Foundry's icons.

Tested on Foundry 13.351 with dnd5e 5.3.3. It should also run on Foundry 12, but that has not been tested.

To remove it, disable it in Manage Modules; nothing is left behind.

## License

MIT, see [LICENSE](LICENSE).
