# Island ambience sources

Prepared on 2026-10-24. The files below are local application assets; playback does not contact the source websites.

| File in `ambience/` | Duration | Format | Use |
| --- | ---: | --- | --- |
| `wind.mp3` | 22.047313 s | MP3, 44.1 kHz, stereo | Wind bed; loop quietly. |
| `water.mp3` | 22.047313 s | MP3, 44.1 kHz, stereo | Stream bed; loop near the river. |
| `birds.mp3` | 25.051429 s container; 25 s decoded content | MP3, 44.1 kHz, mono | Sunset birdsong bed in the island; crossfaded for looping. |
| `rooster.mp3` | 2.351025 s | MP3, 44.1 kHz, stereo | A single rooster crow; play occasionally rather than continuously. |

## Existing project assets

`wind.mp3` is an unchanged copy of the existing user-provided wind sound effect.

`water.mp3` is an unchanged copy of the existing user-provided `water_stream.mp3` sound effect.

These are user-provided assets already used in an earlier local project. Their original authorship/license is not specified by that checkout; this document makes no new third-party license claim for them. They were not synthesized or reencoded for this portfolio.

## Birdsong (original dawn field recording)

- Recording: [Birds Waking #3, sound 0999](https://bigsoundbank.com/wake-birds-3-s0999.html).
- Author: Joseph SARDIN / BigSoundBank.
- Field context supplied by the author: countryside in France, 06:30 on 23 April 2018, recorded using a Tascam DR-40.
- Downloaded original: [0999.mp3](https://bigsoundbank.com/UPLOAD/mp3/0999.mp3).
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), as stated on the recording page and [BigSoundBank license page](https://bigsoundbank.com/licenses.html). Commercial use, modification, and redistribution are permitted; attribution is optional.
- Changes: decoded original seconds 12–38 to 44.1 kHz mono PCM; crossfaded the final second with the first second and omitted that initial second, producing a continuous 25-second loop; encoded MP3 at 128 kb/s. Source field-recording content is preserved; no artificial bird calls were added.
- Original SHA-256: `aa98471a9f33755284d6456cd2a3b9425ae6efa57cb7a8df6bb1ff0597b0ddab`.

## Rooster

- Recording: [Rooster Song, sound 0283](https://bigsoundbank.com/song-of-rooster-s0283.html).
- Author: DenisChardonnet / BigSoundBank.
- Recording description: one outdoor rooster crow.
- Downloaded original: [0283.mp3](https://bigsoundbank.com/UPLOAD/mp3/0283.mp3).
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), as stated on the recording page and [BigSoundBank license page](https://bigsoundbank.com/licenses.html). Commercial use, modification, and redistribution are permitted; attribution is optional.
- Changes: none; copied the original MP3 bytes and renamed the file.

## Verification

All four MP3s were inspected using `ffprobe` and decoded in full using FFmpeg without errors. Combined size: 1,203,158 bytes. The long birdsong original is not shipped with the site.

| Asset | SHA-256 |
| --- | --- |
| `wind.mp3` | `4e56468331d577c2ec2e555622b3b6998ce8537b855e324c2d747069ede569a7` |
| `water.mp3` | `77cfc36ba75680beba59aea84708450049719f27eeaae9a1010c957c206661cf` |
| `birds.mp3` | `9174b90df9c39b903321b7c95a67e889887f44d3be9f2a11bcc655195a0671ab` |
| `rooster.mp3` | `1622124515e4cdc38a1f9fc3f9d37afcb0825e21eb18bdacaf7491e18103006c` |
