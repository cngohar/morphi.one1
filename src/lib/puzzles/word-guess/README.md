# Word Guess — v1.4.6

Classic and ten Batch A presets ship enabled as `word-guess-1`. There are
zero per-variant leaderboard groups and one `(word-guess, UTC date)` board.

| Preset          | Rule                                                                         | Guess budget |
| --------------- | ---------------------------------------------------------------------------- | -----------: |
| `classic`       | One five-letter word, untimed                                                |            6 |
| `hard-mode`     | Keep correct positions and reuse present letters. Grey letters may be reused |            6 |
| `ultra-hard`    | Keep correct positions, move present letters and respect grey copy limits    |            6 |
| `length-4`      | Four-letter word                                                             |            6 |
| `length-6`      | Six-letter word                                                              |            6 |
| `length-7`      | Seven-letter word                                                            |            6 |
| `boards-2`      | One shared guess applies to two distinct words                               |            7 |
| `boards-4`      | One shared guess applies to four distinct words                              |            9 |
| `boards-8`      | One shared guess applies to eight distinct words                             |           13 |
| `countdown-120` | Solve within 120 seconds                                                     |            6 |
| `hint-budget-3` | Up to three deterministic letter reveals                                     |            6 |

Correct positions consume their copies first, then present matches consume
remaining copies from left to right. A grey duplicate indicates no further
copy. An invalid word or constraint violation spends no row. The keyboard
supports on-screen taps and physical letters, Enter and Backspace.

The family-wide `brief-v1` defaults award 100/90/75/60/45/30 for guesses
1–6 and 25/20/15/10/5/5/5 for guesses 7–13. A multi-board win sums the score
at each board's solve guess. Hints deduct 100 each, with a floor of zero.
Countdown wins add 10 per remaining second. A timed-out round saves no score.
A completed loss scores zero and stays off the daily board. A hinted win
displays “solved with hint” on the result. When the pinned config allows
hinted wins to rank, the daily board also labels the entry, including at
zero points. The ranked floor is 2,500 ms.

## Local evidence

26 unit and 13 D1 cases passed, along with 48 single-worker Chromium cases.
All six runtimes agreed on 33 seeded rounds, 33 wins, 33 losses and 66
rejected replays. The deterministic solver proved all 1,881 curated answers
solvable in five guesses or fewer. See the
[phase report](../../../../docs/PHASE_REPORTS.md) for measurements, captures
and owner-review items.

## Word provenance and editorial policy

ENABLE: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
(public domain), SHA-256 3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89.
SCOWL: https://github.com/en-wl/wordlist/tree/rel-2020.12.07, source archive
SHA-256 99c4da4027bf5c82ca96238877f9fe5c8b5782c370ce05102f3f4f8c86f97ce4.
SCOWL was built locally from that tag. Answers use ordinary lowercase English/
American/British words in size 10 with explicit familiar additions from sizes
≤35. Guesses are ENABLE intersected with SCOWL ≤35, plus legal demo seed guesses.
Names/abbreviations are excluded by source categories and ASCII lowercase.
Editorial exclusions remove sensitive terms and obscure/jargon entries; simple
S/ES/IES plurals and ED/IED/doubled-consonant past forms are excluded using ENABLE
roots. All demo answers are retained. Sorted word arrays are immutable replay identity.
The solver minimizes integer collision partitions (sum of squares), with ties
prefer remaining answers, then ASCII order. No secret answer influences guess
choice. The solver runs at daily issuance, never during gameplay.

### SCOWL source notice

The collective work is Copyright 2000-2018 by Kevin Atkinson as well
as any of the copyrights mentioned below:

Copyright 2000-2018 by Kevin Atkinson

Permission to use, copy, modify, distribute and sell these word
lists, the associated scripts, the output created from the scripts,
and its documentation for any purpose is hereby granted without fee,
provided that the above copyright notice appears in all copies and
that both that copyright notice and this permission notice appear in
supporting documentation. Kevin Atkinson makes no representations
about the suitability of this array for any purpose. It is provided
"as is" without express or implied warranty.

Alan Beale <biljir@pobox.com> also deserves special credit as he has,
in addition to providing the 12Dicts package and being a major
contributor to the ENABLE word list, given me an incredible amount of
feedback and created a number of special lists (those found in the
Supplement) in order to help improve the overall quality of SCOWL.

The 10 level includes the 1000 most common English words (according to
the Moby (TM) Words II [MWords] package), a subset of the 1000 most
common words on the Internet (again, according to Moby Words II), and
frequently class 16 from Brian Kelk's "UK English Wordlist
with Frequency Classification".

The MWords package was explicitly placed in the public domain:

    The Moby lexicon project is complete and has
    been place into the public domain. Use, sell,
    rework, excerpt and use in any way on any platform.

    Placing this material on internal or public servers is
    also encouraged. The compiler is not aware of any
    export restrictions so freely distribute world-wide.

    You can verify the public domain status by contacting

    Grady Ward
    3449 Martha Ct.
    Arcata, CA  95521-4884

    grady@netcom.com
    grady@northcoast.com

The "UK English Wordlist With Frequency Classification" is also in the
Public Domain:

Date: Sat, 08 Jul 2000 20:27:21 +0100
From: Brian Kelk <Brian.Kelk@cl.cam.ac.uk>

> I was wondering what the copyright status of your "UK English
> Wordlist With Frequency Classification" word list as it seems to
> be lacking any copyright notice.

There were many many sources in total, but any text marked
"copyright" was avoided. Locally-written documentation was one
source. An earlier version of the list resided in a filespace called
PUBLIC on the University mainframe, because it was considered public
domain.

Date: Tue, 11 Jul 2000 19:31:34 +0100

> So are you saying your word list is also in the public domain?

That is the intention.

The 20 level includes frequency classes 7-15 from Brian's word list.

The 35 level includes frequency classes 2-6 and words appearing in at
least 11 of 12 dictionaries as indicated in the 12Dicts package. All
words from the 12Dicts package have had likely inflections added via
my inflection database.

The 12Dicts package and Supplement is in the Public Domain.

The WordNet database, which was used in the creation of the
Inflections database, is under the following copyright:

This software and database is being provided to you, the LICENSEE,
by Princeton University under the following license. By obtaining,
using and/or copying this software and database, you agree that you
have read, understood, and will comply with these terms and
conditions.:

Permission to use, copy, modify and distribute this software and
database and its documentation for any purpose and without fee or
royalty is hereby granted, provided that you agree to comply with
the following copyright notice and statements, including the
disclaimer, and that the same appear on ALL copies of the software,
database and documentation, including modifications that you make
for internal use or for distribution.

WordNet 1.6 Copyright 1997 by Princeton University. All rights
reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY
THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.

The name of Princeton University or Princeton may not be used in
advertising or publicity pertaining to distribution of the software
and/or database. Title to copyright in this software, database and
any associated documentation shall at all times remain with
Princeton University and LICENSEE agrees to preserve same.

The 40 level includes words from Alan's 3esl list found in version 4.0
of his 12dicts package. Like his other stuff the 3esl list is also in the
public domain.

The 50 level includes Brian's frequency class 1, words appearing
in at least 5 of 12 of the dictionaries as indicated in the 12Dicts
package, and uppercase words in at least 4 of the previous 12
dictionaries. A decent number of proper names is also included: The
top 1000 male, female, and Last names from the 1990 Census report; a
list of names sent to me by Alan Beale; and a few names that I added
myself. Finally a small list of abbreviations not commonly found in
other word lists is included.

The name files form the Census report is a government document which I
don't think can be copyrighted.

The file special-jargon.50 uses common.lst and word.lst from the
"Unofficial Jargon File Word Lists" which is derived from "The Jargon
File". All of which is in the Public Domain. This file also contain
a few extra UNIX terms which are found in the file "unix-terms" in the
special/ directory.

The 55 level includes words from Alan's 2of4brif list found in version
4.0 of his 12dicts package. Like his other stuff the 2of4brif is also
in the public domain.

The 60 level includes all words appearing in at least 2 of the 12
dictionaries as indicated by the 12Dicts package.

The 70 level includes Brian's frequency class 0 and the 74,550 common
dictionary words from the MWords package. The common dictionary words,
like those from the 12Dicts package, have had all likely inflections
added. The 70 level also included the 5desk list from version 4.0 of
the 12Dics package which is in the public domain.

The 80 level includes the ENABLE word list, all the lists in the
ENABLE supplement package (except for ABLE), the "UK Advanced Cryptics
Dictionary" (UKACD), the list of signature words from the YAWL package,
and the 10,196 places list from the MWords package.

The ENABLE package, mainted by M\Cooper <thegrendel@theriver.com>,
is in the Public Domain:

The ENABLE master word list, WORD.LST, is herewith formally released
into the Public Domain. Anyone is free to use it or distribute it in
any manner they see fit. No fee or registration is required for its
use nor are "contributions" solicited (if you feel you absolutely
must contribute something for your own peace of mind, the authors of
the ENABLE list ask that you make a donation on their behalf to your
favorite charity). This word list is our gift to the Scrabble
community, as an alternate to "official" word lists. Game designers
may feel free to incorporate the WORD.LST into their games. Please
mention the source and credit us as originators of the list. Note
that if you, as a game designer, use the WORD.LST in your product,
you may still copyright and protect your product, but you may _not_
legally copyright or in any way restrict redistribution of the
WORD.LST portion of your product. This _may_ under law restrict your
rights to restrict your users' rights, but that is only fair.

UKACD, by J Ross Beresford <ross@bryson.demon.co.uk>, is under the
following copyright:

Copyright (c) J Ross Beresford 1993-1999. All Rights Reserved.

The following restriction is placed on the use of this publication:
if The UK Advanced Cryptics Dictionary is used in a software package
or redistributed in any form, the copyright notice must be
prominently displayed and the text of this document must be included
verbatim.

There are no other restrictions: I would like to see the list
distributed as widely as possible.

The 95 level includes the 354,984 single words, 256,772 compound
words, 4,946 female names and the 3,897 male names, and 21,986 names
from the MWords package, ABLE.LST from the ENABLE Supplement, and some
additional words found in my part-of-speech database that were not
found anywhere else.

Accent information was taken from UKACD.

The VarCon package was used to create the American, British, Canadian,
and Australian word list. It is under the following copyright:

Copyright 2000-2016 by Kevin Atkinson

Permission to use, copy, modify, distribute and sell this array, the
associated software, and its documentation for any purpose is hereby
granted without fee, provided that the above copyright notice appears
in all copies and that both that copyright notice and this permission
notice appear in supporting documentation. Kevin Atkinson makes no
representations about the suitability of this array for any
purpose. It is provided "as is" without express or implied warranty.

Copyright 2016 by Benjamin Titze

Permission to use, copy, modify, distribute and sell this array, the
associated software, and its documentation for any purpose is hereby
granted without fee, provided that the above copyright notice appears
in all copies and that both that copyright notice and this permission
notice appear in supporting documentation. Benjamin Titze makes no
representations about the suitability of this array for any
purpose. It is provided "as is" without express or implied warranty.

Since the original words lists come from the Ispell distribution:

Copyright 1993, Geoff Kuenning, Granada Hills, CA
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. All modifications to the source code must be clearly marked as
   such. Binary redistributions based on modified source code
   must be clearly marked as modified versions in the documentation
   and/or other materials provided with the distribution.
   (clause 4 removed with permission from Geoff Kuenning)
4. The name of Geoff Kuenning may not be used to endorse or promote
   products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY GEOFF KUENNING AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL GEOFF KUENNING OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.
