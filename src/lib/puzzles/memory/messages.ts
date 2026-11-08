export const messages = {
	'variant.memory:classic': 'Classic',
	'variant.memory:no-preview': 'No preview',
	'variant.memory:trios': 'Trios',
	'variant.memory:moving': 'Moving cards',
	'variant.memory:budget': 'Tight Budget',
	'variant.memory:lockout': 'Lockout',
	'variant.memory:swaps': 'Marked Swaps',
	'variant.memory:two-backs': 'Two Backs',
	'variant.memory:quads': 'Quads',
	'variant.memory:collapse': 'Collapse',
	'variant.memory:countdown': 'Countdown',
	'variant.memory:three-strikes': 'Three Strikes',
	'variant.memory:wild-card': 'Wild Card',
	'variant.memory:sonar': 'Sonar Ping',
	'variant.memory:zebra': 'Zebra Bicolor',
	'variant.memory:drift': 'Row Drift',
	'variant.memory:decay': 'Fading Clue',
	'variant.memory:one-flip': 'One Flip',
	'variant.memory:combo': 'Combo Multiplier',
	'variant.memory:hazard': 'Hazard Trap',
	'variant.memory:superstorm': 'Superstorm',
	'variant.memory:sentinel-heat': 'Sentinel Heat',
	'variant.memory:glyph-chain': 'Atlas Glyph',
	'variant.memory:analysis-visor': 'Analysis Visor',
	'variant.memory:life-support': 'Life Support',
	'variant.memory:hyperdrive-warp': 'Warp Jump',
	'variant.memory:gravitino-risk': 'Gravitino Risk',
	'variant.memory:pulse-drive': 'Pulse Drive',
	'variant.memory:derelict-fog': 'Derelict Fog',
	'variant.memory:atlas-terminal': '16 / 16 Loop',
	'variant.memory:edge-cache': 'Edge Cache',
	'variant.memory:quantum-entangle': 'Quantum Entangle',
	'variant.memory:rate-limiter': 'Rate Limiter',
	'variant.memory:register-buffer': 'Register Buffer',
	'variant.memory:firewall-ice': 'Firewall ICE',
	'variant.memory:anycast-route': 'Anycast Route',
	'variant.memory:tls-handshake': 'TLS Handshake',
	'variant.memory:trace-route': 'Security Trace',
	'variant.memory:bit-rot': 'Bit-Rot',
	'variant.memory:burst-transmission': 'Burst Uplink',
	'variant.memory:kv-consistency': 'KV Consistency',
	'variant.memory:durable-object': 'Durable Object',
	'variant.memory:vectorize-knn': 'Vectorize KNN',
	'variant.memory:fifo-queue': 'FIFO Queue',
	'variant.memory:ai-tokens': 'Workers AI',
	'variant.memory:hyperdrive-pool': 'Hyperdrive',
	'variant.memory:turnstile-verify': 'Turnstile',
	'variant.memory:zero-trust': 'Zero Trust',
	'variant.memory:argo-reroute': 'Argo Route',
	'variant.memory:r2-glacier': 'R2 Glacier',
	'variant.memory:cross-pollination': 'Cross-Pollination',
	'variant.memory:mycelium-network': 'Mycelium Network',
	'variant.memory:photosynthesis': 'Photosynthesis',
	'variant.memory:seed-dispersal': 'Seed Dispersal',
	'variant.memory:seasonal-bloom': 'Seasonal Bloom',
	'variant.memory:bee-waggle': 'Bee Waggle',
	'variant.memory:carnivorous-briar': 'Carnivorous Briar',
	'variant.memory:chlorophyll-meter': 'Chlorophyll Meter',
	'variant.memory:bioluminescent': 'Bioluminescent Spores',
	'variant.memory:botanical-graft': 'Botanical Graft',
	'variant.memory:workflows-step': 'Workflows Step',
	'variant.memory:browser-rendering': 'Browser Run Snapshot',
	'variant.memory:ai-gateway': 'AI Gateway',
	'variant.memory:k2-streams': 'K2 Streams',
	'variant.memory:basin-catalog': 'Basin Catalog',
	'variant.memory:edge-snippets': 'Edge Snippets',
	'variant.memory:images-transform': 'Images Transform',
	'variant.memory:waiting-room': 'Waiting Room',
	'variant.memory:privacy-pass': 'Privacy Pass',
	'variant.memory:agents-sdk': 'Agents SDK',
	'memory.countdown.step2':
		'Clear the board before the countdown clock reaches zero. Running out of time ends the round with no score.',
	'memory.countdown.tips': 'Maintain a brisk pace; hesitating too long costs the round.',
	'memory.threeStrikes.step2':
		'You have three lives. Every miss costs a life; three strikes ends the round.',
	'memory.threeStrikes.tips': 'Never guess when you are unsure; prioritize guaranteed matches.',
	'memory.wildCard.step2':
		'The deck contains a Wild card. It matches with whichever card you flip with it.',
	'memory.wildCard.tips':
		'Use the Wild card on an isolated symbol whose partner has not been found.',
	'memory.sonar.step2':
		'Matching a pair briefly flashes adjacent face-down cards face up as a radar ping.',
	'memory.sonar.tips': 'Watch the cards surrounding each match for instant clues.',
	'memory.zebra.step2':
		'Every symbol exists in Light and Dark. A match requires one of each color.',
	'memory.zebra.tips': 'Two cards of the same color never match even with the same symbol.',
	'memory.drift.step2':
		'After a miss, the row containing the first card shifts horizontally by one position.',
	'memory.drift.tips': 'Track row positions as they slide across the board.',
	'memory.decay.step2':
		'Seen cards expire after three attempts if not matched, relocating elsewhere.',
	'memory.decay.tips': 'Match seen cards quickly before their locations vanish.',
	'memory.oneFlip.step2':
		'Flip one card at a time. It remains face up until the next card is flipped.',
	'memory.oneFlip.tips': 'Chain rolling matches continuously.',
	'memory.combo.step2':
		'Consecutive matches without a miss escalate a streak multiplier for bonus score.',
	'memory.combo.tips': 'Protect your streak; a miss resets the multiplier to 1x.',
	'memory.hazard.step2': 'Avoid the Trap card. Flipping it reshuffles all face-down cards.',
	'memory.hazard.tips': 'Remember where the Trap card is and steer clear of it.',
	'memory.superstorm.step2':
		'Every four misses triggers an extreme storm, frosting over and locking the active row for one turn.',
	'memory.superstorm.tips':
		'Work around frosted rows while waiting for weather conditions to clear.',
	'memory.sentinelHeat.step2':
		'Misses raise Sentinel alert levels. Reaching three stars triggers a drone lock on the revealed card.',
	'memory.sentinelHeat.tips': 'Score clean matches to cool down heat before patrols intervene.',
	'memory.glyphChain.step2':
		'Portal glyphs must be matched in ascending sequence tiers. You can flip ahead, but pairs only clear in order.',
	'memory.glyphChain.tips': 'Scout locations freely, then solve in strict tier sequence.',
	'memory.analysisVisor.step2':
		'Your visor displays spectral category bands on card backs to provide clues before flipping.',
	'memory.analysisVisor.tips': 'Match cards that share matching category bands.',
	'memory.lifeSupport.step2':
		'Flips consume Exosuit life support power. Successful matches recharge power; reaching zero percent fails the round.',
	'memory.lifeSupport.tips': 'Keep an eye on suit reserves and prioritize high-confidence matches.',
	'memory.hyperdriveWarp.step2':
		'Matching the Space Anomaly pair warps space-time, shifting remaining unmatched cards diagonally.',
	'memory.hyperdriveWarp.tips': 'Prepare for the grid to transpose once the Anomaly is discovered.',
	'memory.gravitinoRisk.step2':
		'The deck has a high-value Gravitino Orb. Matching it immediately awards bonus score; a miss scrambles its column.',
	'memory.gravitinoRisk.tips': 'Only flip the Gravitino Orb when you know where its partner is.',
	'memory.pulseDrive.step2':
		'Chaining matches in rapid succession engages pulse speed multipliers up to four times.',
	'memory.pulseDrive.tips': 'Maintain momentum for maximum navigation bonuses.',
	'memory.derelictFog.step2':
		'The board is in deep darkness. Flipping a card casts a flashlight beam illuminating adjacent cards.',
	'memory.derelictFog.tips': 'Use each flip to map out surrounding corridors.',
	'memory.atlasTerminal.step2':
		'Every sixteen flips, the Atlas simulation reality pulse triggers, reshuffling frequently flipped cards.',
	'memory.atlasTerminal.tips':
		'Solve before the cosmic reset cycle scrambles over-inspected sectors.',
	'memory.edgeCache.step2':
		'Inspected cards leave a temporary cached ghost preview on their card back for two turns.',
	'memory.edgeCache.tips': 'Match cards quickly before their edge cache TTL expires.',
	'memory.quantumEntangle.step2':
		'Entangled quantum nodes reveal together simultaneously when either card is flipped.',
	'memory.quantumEntangle.tips':
		'Look for entangled twin pairs to reveal two nodes for the cost of one flip.',
	'memory.rateLimiter.step2':
		'Consecutive rapid mismatches trigger a 429 rate limit cooldown lockout on the board.',
	'memory.rateLimiter.tips': 'Pace your moves deliberately to keep throughput high.',
	'memory.registerBuffer.step2':
		'Stash a revealed card into your dedicated 1-card buffer and pair with it later.',
	'memory.registerBuffer.tips':
		'Hold an isolated card in the buffer register until its matching symbol is found.',
	'memory.firewallIce.step2':
		'Central firewall cells are shielded. Matching adjacent neighbor cards breaches the shield.',
	'memory.firewallIce.tips':
		'Clear perimeter nodes adjacent to the firewall to unlock inner cells.',
	'memory.anycastRoute.step2':
		'Every three mismatches triggers an anycast route rebalance, shifting perimeter cards clockwise.',
	'memory.anycastRoute.tips': 'Track the perimeter rotation sequence as outer cards circulate.',
	'memory.tlsHandshake.step2':
		'Establish cryptographic handshakes by pairing Client Hello (SYN) and Server Hello (ACK) cards.',
	'memory.tlsHandshake.tips': 'Match cards sharing matching cryptographic cipher suites.',
	'memory.traceRoute.step2':
		'Mismatches escalate network trace. Reaching 100 percent quarantines cards into lockdown.',
	'memory.traceRoute.tips':
		'Score clean matches to reduce trace levels before quarantine triggers.',
	'memory.bitRot.step2':
		'Unmatched inspected cards suffer bit-rot data corruption after three turns and swap places.',
	'memory.bitRot.tips': 'Prioritize inspected cards before bit-rot corruption displaces them.',
	'memory.burstTransmission.step2':
		'Chaining consecutive matches triggers a high-speed packet burst pinging hidden cards.',
	'memory.burstTransmission.tips':
		'Chain clean matches to trigger packet burst illumination pings.',
	'memory.kvConsistency.step2':
		'Inspected cards encounter replication lag before values settle. Quick consensus matches grant bonuses.',
	'memory.kvConsistency.tips': 'Pair cards quickly before replica consistency completes.',
	'memory.durableObject.step2':
		'Each grid row is a single-threaded actor coordinator. Matches must be found in a different actor row.',
	'memory.durableObject.tips':
		'Avoid flipping in the same row twice; span cross-actor rows to find pairs.',
	'memory.vectorizeKnn.step2':
		'Cards hold semantic embedding tags. Pair any two cards from the same semantic cluster.',
	'memory.vectorizeKnn.tips':
		'Match cards sharing vector categories rather than identical duplicate icons.',
	'memory.fifoQueue.step2':
		'Flips buffer into a 2-slot consumer batch. Mismatches route messages to the Dead-Letter Queue shelf.',
	'memory.fifoQueue.tips':
		'Keep the consumer queue flowing and minimize dead-letter shelf overflows.',
	'memory.aiTokens.step2':
		'Flips burn context window tokens; matches reward tokens. Complete before context overflow occurs.',
	'memory.aiTokens.tips': 'Conserve inference tokens; avoid wasteful hallucination mismatches.',
	'memory.hyperdrivePool.step2':
		'Rapid consecutive play maintains a HOT connection pool. Idling drops to COLD with latency delay.',
	'memory.hyperdrivePool.tips':
		'Maintain quick query pace to preserve the HOT connection multiplier.',
	'memory.turnstileVerify.step2':
		'Every four mismatches triggers a Turnstile bot challenge pause. Authenticate to resume play.',
	'memory.turnstileVerify.tips':
		'Avoid excessive mismatches to prevent managed challenge interruptions.',
	'memory.zeroTrust.step2':
		'Cards are partitioned into clearance tiers. Clear all lower-tier pairs to unlock higher tiers.',
	'memory.zeroTrust.tips':
		'Authenticate Public pairs first to authorize Confidential and Secret nodes.',
	'memory.argoReroute.step2':
		'Repeated flips in one quadrant cause traffic congestion. Argo dynamically reroutes cards to cold sectors.',
	'memory.argoReroute.tips':
		'Distribute flips across quadrants to avoid triggering dynamic traffic swaps.',
	'memory.r2Glacier.step2':
		'Cards untouched for four turns transition to Glacier Cold Archive, requiring a hydration cycle to thaw.',
	'memory.r2Glacier.tips': 'Rotate your memory coverage to prevent cold data archiving.',
	'memory.crossPollination.step2':
		'Flowers and pollinators are divided into two garden beds. Every match must cross between the Meadow and the Grove.',
	'memory.crossPollination.tips':
		'Never flip two cards in the same bed; pairs always cross the garden perimeter.',
	'memory.myceliumNetwork.step2':
		'Underground mycelium root threads send a spore pulse pointing toward the partner bed upon flipping a card.',
	'memory.myceliumNetwork.tips':
		'Follow the subterranean mycelial root pulse to locate reciprocal blooms.',
	'memory.photosynthesis.step2':
		'A rotating sunbeam illuminates one garden row every two turns, providing a sunlight bloom preview.',
	'memory.photosynthesis.tips':
		'Plan your moves to take advantage of rows currently bathed in direct sunlight.',
	'memory.seedDispersal.step2':
		'Mismatches trigger an autumn breeze, causing unpicked seed pods to drift and swap positions.',
	'memory.seedDispersal.tips':
		'Track where seed pods drift when winds scatter petals across the garden.',
	'memory.seasonalBloom.step2':
		'Flowers unvisited for three turns wilt into dormant root bulbs. Rejuvenate bulbs to restore their bloom.',
	'memory.seasonalBloom.tips':
		'Revisit dormant bulbs before perennial wilt spreads across the garden bed.',
	'memory.beeWaggle.step2':
		'Flipping a honeybee in the Grove performs a waggle dance with an arrow pointing toward the matching flower.',
	'memory.beeWaggle.tips':
		'Read the honeybee foraging vector dance to navigate straight to the blossom.',
	'memory.carnivorousBriar.step2':
		'Two Grove cards are trapped in thorny briars. Discover the Morning Dewdrop in the Meadow to dissolve the thorns.',
	'memory.carnivorousBriar.tips':
		'Find the dewdrop early to liberate trapped blossoms from the briar patch.',
	'memory.chlorophyllMeter.step2':
		'Flips consume sap; matches replenish sap. Complete the garden before drought wilt drains your sap reservoir.',
	'memory.chlorophyllMeter.tips':
		'Maintain a positive sap balance by prioritizing high-confidence cross-pollinations.',
	'memory.bioluminescent.step2':
		'Nocturnal spore rings on card backs indicate petal symmetry to guide your botanical pairings.',
	'memory.bioluminescent.tips':
		'Use spore ring symmetry hints on card backs to narrow down floral candidates.',
	'memory.botanicalGraft.step2':
		'Consecutive cross-pollinations trigger orchard grafting, escalating a biodiversity combo multiplier.',
	'memory.botanicalGraft.tips':
		'Chain unbroken cross-pollinations to harvest champion hybrid graft bonuses.',
	'memory.workflowsStep.step2':
		'Turns execute in durable workflows. On a mismatch, Step 2 gives you one row retry before state rollback.',
	'memory.workflowsStep.tips': 'Use the step retry wisely to find matching adjacent candidates.',
	'memory.browserRendering.step2':
		'Every four flips, a headless browser snapshot scans DOM coordinates to illuminate unrevealed sectors.',
	'memory.browserRendering.tips': 'Pay attention to illuminated borders after the scan pulses.',
	'memory.aiGateway.step2':
		'Revisiting known cards triggers a fast Cache HIT. Rapid blind flips under 350ms trigger a 429 rate-limit backoff.',
	'memory.aiGateway.tips': 'Rely on semantic cache hits and pace your exploration deliberately.',
	'memory.k2Streams.step2':
		'Flips append to a continuous stream log. Pairing the symbol targeted by the reader cursor awards a 2.5x burst bonus.',
	'memory.k2Streams.tips': 'Time your matches to hit the stream cursor target for big multipliers.',
	'memory.basinCatalog.step2':
		'Cards are grouped into Iceberg partition columns. Flipping card one restricts the second flip to that partition.',
	'memory.basinCatalog.tips':
		'Identify which partition column a card belongs to before committing candidate flips.',
	'memory.edgeSnippets.step2':
		'Matches execute an edge snippet micro-transform that injects dynamic modifier headers into the next turn.',
	'memory.edgeSnippets.tips': 'Adapt your strategy to the active injected snippet modifier.',
	'memory.imagesTransform.step2':
		'Card symbols start under heavy blur and progressively sharpen to crystal clarity as nearby cards pair.',
	'memory.imagesTransform.tips': 'Clear adjacent pairs to bring blurry icons into sharp focus.',
	'memory.waitingRoom.step2':
		'You have three concurrent admission tokens. Rapid mismatches exhaust tokens and trigger an admission queue delay.',
	'memory.waitingRoom.tips': 'Preserve admission tokens with high-confidence matches.',
	'memory.privacyPass.step2':
		'You start with three blind cryptographic tokens. Spend a token to execute a private zero-knowledge peek.',
	'memory.privacyPass.tips': 'Spend blind tokens strategically on high-uncertainty cards.',
	'memory.agentsSdk.step2':
		'An autonomous edge agent observes turn entropy. Every three matches, the agent executes a tool call to highlight a pair.',
	'memory.agentsSdk.tips': 'Coordinate with your agent co-pilot when tool assistance activates.',
	'scoring.memory.quad': 'Points per quad',
	'memory.quads.label': 'Quads',
	'memory.quads.hint': '{pairs} quads · Find four matching symbols',
	'memory.quads.memorize': 'Memorize the quads',
	'memory.quads.won': 'All quads found',
	'memory.quads.summary': '{pairs} quads · {moves} moves · {time}',
	'ending.memory.quads.headline': 'All quads found!',
	'ending.memory.quads.subline': '{pairs} quads · {time}',
	'memory.quads.step1': 'Turn over four cards per attempt. Four identical symbols stay face up.',
	'memory.quads.step2': 'Any other set turns back over. Find every quad to finish.',
	'memory.quads.step3': 'Memorize the opening preview. The limit is 24 flips per quad.',
	'memory.quads.row1': 'Quad matched',
	'memory.quads.tips':
		'Remember all four positions for each symbol. A careful match can save an attempt.',
	'memory.budget.left': 'Left',
	'memory.budget.leftFull': 'Attempts left',
	'memory.budget.step2':
		'Every attempt counts, match or miss. You get two attempts per pair, so clear the board before they run out.',
	'memory.budget.step3':
		'Running out ends the round with no score or saved result. Use the opening preview.',
	'memory.budget.tips': 'A miss costs an attempt as well as points. Match only when you are sure.',
	'memory.budget.hint': '{pairs} pairs · {left} of {limit} attempts left',
	'memory.budget.over': 'Run over',
	'memory.budget.overBody':
		'No attempts left. No score or result was saved. Use Home or try another puzzle.',
	'memory.budget.tryAnother': 'Try another',
	'memory.lockout.step2':
		'After a miss, the last card you turned is locked for your next attempt. Choose other cards; it unlocks afterwards.',
	'memory.lockout.tips': 'Use the locked turn to learn a new card instead of repeating the miss.',
	'memory.lockout.locked': 'Not a match. Card {number} is locked for your next attempt.',
	'memory.lockout.released': 'Lock released.',
	'memory.lockout.ignored': 'Card {number} is locked for this attempt.',
	'card.lockedDown': 'Card {number}, face down, locked for this attempt',
	'memory.swaps.step2':
		'After a miss, two face-down cards swap places. Both are marked until your next flip.',
	'memory.swaps.tips': 'Follow the marked cards: whatever you remembered there has traded places.',
	'memory.swaps.swapped': 'Cards {a} and {b} swapped places.',
	'card.swappedDown': 'Card {number}, face down, swapped',
	'memory.twoBacks.step2':
		'Backs are dotted or striped. A pair always has one of each, so look for the other back.',
	'memory.twoBacks.tips': 'Two cards with the same back can never match, so skip them.',
	'back.dotted': 'dotted',
	'back.striped': 'striped',
	'card.downBack': 'Card {number}, face down, {back} back',
	'memory.collapse.step2':
		'Matched cards leave and the rest close up in reading order, so positions change after every match.',
	'memory.collapse.tips':
		'Recount positions after every match. Cards keep their order, not their place.',
	'memory.error': 'This puzzle stopped responding. Use Home to start a fresh round.',
	'memory.variantLabel': 'Memory · {variant}',
	'scoring.memory.trio': 'Points per trio',
	'memory.trios.label': 'Trios',
	'memory.trios.hint': '{pairs} trios · Find three matching symbols',
	'memory.trios.memorize': 'Memorize the trios',
	'memory.trios.won': 'All trios found',
	'memory.trios.summary': '{pairs} trios · {moves} moves · {time}',
	'memory.trios.cap': 'Flip limit reached. Use Home to start another round.',
	'memory.trios.flips': '{flips} / {limit} flips',
	'ending.memory.trios.headline': 'All trios found!',
	'ending.memory.trios.subline': '{pairs} trios · {time}',
	'memory.noPreview.step3': 'Cards start face down. There is no free opening allowance.',
	'memory.noPreview.scoringNote': 'Ranked rounds use server time with no opening allowance.',
	'memory.noPreview.tips': 'Scan in a consistent order and connect each symbol to its position.',
	'memory.trios.step1': 'Turn over three cards per attempt. Three identical symbols stay face up.',
	'memory.trios.step2': 'Any other set turns back over. Find every trio to finish.',
	'memory.trios.step3': 'Memorize the opening preview. The limit is 18 flips per trio.',
	'memory.trios.row1': 'Trio matched',
	'memory.trios.tips':
		'Remember all three positions for each symbol. A careful match can save an attempt.',
	'memory.moving.step2':
		'After a mismatch, the still face-down unmatched cards shuffle. Revealed and matched cards stay in place.',
	'memory.moving.tips':
		'After a mismatch, learn the new positions. Matched cards and the last revealed pair stay pinned during the shuffle.',
	'ending.memory.headline': 'All pairs found!',
	'ending.memory.subline': '{pairs} pairs · {time}',
	'scoring.memory.pair': 'Points per pair',
	'scoring.memory.mismatch': 'Penalty per mismatch',
	'scoring.memory.second': 'Penalty per elapsed second',
	'v11.game.mismatchesShort': 'MISM.',
	'symbol.crescent': 'crescent',
	'symbol.petals': 'petals',
	'v1.memory.metaDescription':
		'Match the pairs, sharpen your memory, and beat your high score in this free online memory game. Play instantly on Morphi.One.',
	'v1.game.mismatches': 'Mismatches',
	'v1.game.memory.eyebrow': 'Play the free memory game online',
	'v1.game.memory.step1': 'Turn over any two cards. Matching symbols stay face up.',
	'v1.game.memory.step2': 'Different symbols turn back over. Find every pair to finish.',
	'v1.game.memory.step3': 'The opening preview is free: note where a few symbols sit.',
	'v1.game.memory.row1': 'Pair matched',
	'v1.game.memory.value1': '+1,000',
	'v1.game.memory.row2': 'Mismatch',
	'v1.game.memory.value2': '−150',
	'v1.game.memory.row3': 'Each second',
	'v1.game.memory.value3': '−5',
	'v1.game.memory.row4': 'Floor',
	'v1.game.memory.value4': 'Never below 0',
	'v1.game.memory.scoringNote': 'Ranked rounds are timed by the server, not by your device.',
	'v1.meta.memory': 'Free Online Memory Matching Game | Morphi.One',
	'v1.nav.memory': 'Memory game',
	'v1.game.memory.title': 'Play the Free Memory Matching Game',
	'v1.game.memory.intro': 'Match the pairs, sharpen your memory, and beat your high score.',
	'v1.game.memory': 'Memory',
	'v1.game.memory.how':
		'Turn over two cards. Matching symbols stay face up; different symbols turn back over. Find every pair to finish the round. Use the symbol as well as its color.',
	'v1.game.memory.scoring':
		'Start with 1,000 points per pair. Each mismatch costs 150 points and each whole second costs 5. Your score never falls below zero. Ranked rounds use server time, excluding the fixed opening allowance and including background time.',
	'v1.game.memory.tips':
		'Use the opening preview to remember a few pairs. Scan in a consistent order and connect each symbol to its position. A careful match can be better than a quick guess.',
	'v1.game.card': 'Card {index}',
	'v1.game.symbol': 'Symbol {symbol}',
	'v1.memory.titleTag': 'Free Online Memory Matching Game | Morphi.One',
	'leaderboard.memory.no-preview.6': 'Memory · No preview · 6 pairs',
	'leaderboard.memory.no-preview.8': 'Memory · No preview · 8 pairs',
	'leaderboard.memory.no-preview.10': 'Memory · No preview · 10 pairs',
	'leaderboard.memory.trios.6': 'Memory · Trios · 6 trios',
	'leaderboard.memory.trios.8': 'Memory · Trios · 8 trios',
	'leaderboard.memory.trios.10': 'Memory · Trios · 10 trios',
	'leaderboard.memory.moving.6': 'Memory · Moving cards · 6 pairs',
	'leaderboard.memory.moving.8': 'Memory · Moving cards · 8 pairs',
	'leaderboard.memory.moving.10': 'Memory · Moving cards · 10 pairs',
	'leaderboard.memory.budget.6': 'Memory · Tight Budget · 6 pairs',
	'leaderboard.memory.budget.8': 'Memory · Tight Budget · 8 pairs',
	'leaderboard.memory.budget.10': 'Memory · Tight Budget · 10 pairs',
	'leaderboard.memory.lockout.6': 'Memory · Lockout · 6 pairs',
	'leaderboard.memory.lockout.8': 'Memory · Lockout · 8 pairs',
	'leaderboard.memory.lockout.10': 'Memory · Lockout · 10 pairs',
	'leaderboard.memory.swaps.6': 'Memory · Marked Swaps · 6 pairs',
	'leaderboard.memory.swaps.8': 'Memory · Marked Swaps · 8 pairs',
	'leaderboard.memory.swaps.10': 'Memory · Marked Swaps · 10 pairs',
	'leaderboard.memory.two-backs.6': 'Memory · Two Backs · 6 pairs',
	'leaderboard.memory.two-backs.8': 'Memory · Two Backs · 8 pairs',
	'leaderboard.memory.two-backs.10': 'Memory · Two Backs · 10 pairs',
	'leaderboard.memory.quads.4': 'Memory · Quads · 4 quads',
	'leaderboard.memory.quads.5': 'Memory · Quads · 5 quads',
	'leaderboard.memory.quads.6': 'Memory · Quads · 6 quads',
	'leaderboard.memory.collapse.6': 'Memory · Collapse · 6 pairs',
	'leaderboard.memory.collapse.8': 'Memory · Collapse · 8 pairs',
	'leaderboard.memory.collapse.10': 'Memory · Collapse · 10 pairs',
	'leaderboard.memory.countdown.6': 'Memory · Countdown · 6 pairs',
	'leaderboard.memory.countdown.8': 'Memory · Countdown · 8 pairs',
	'leaderboard.memory.countdown.10': 'Memory · Countdown · 10 pairs',
	'leaderboard.memory.three-strikes.6': 'Memory · Three Strikes · 6 pairs',
	'leaderboard.memory.three-strikes.8': 'Memory · Three Strikes · 8 pairs',
	'leaderboard.memory.three-strikes.10': 'Memory · Three Strikes · 10 pairs',
	'leaderboard.memory.wild-card.6': 'Memory · Wild Card · 6 pairs',
	'leaderboard.memory.wild-card.8': 'Memory · Wild Card · 8 pairs',
	'leaderboard.memory.wild-card.10': 'Memory · Wild Card · 10 pairs',
	'leaderboard.memory.sonar.6': 'Memory · Sonar Ping · 6 pairs',
	'leaderboard.memory.sonar.8': 'Memory · Sonar Ping · 8 pairs',
	'leaderboard.memory.sonar.10': 'Memory · Sonar Ping · 10 pairs',
	'leaderboard.memory.zebra.6': 'Memory · Zebra Bicolor · 6 pairs',
	'leaderboard.memory.zebra.8': 'Memory · Zebra Bicolor · 8 pairs',
	'leaderboard.memory.zebra.10': 'Memory · Zebra Bicolor · 10 pairs',
	'leaderboard.memory.drift.6': 'Memory · Row Drift · 6 pairs',
	'leaderboard.memory.drift.8': 'Memory · Row Drift · 8 pairs',
	'leaderboard.memory.drift.10': 'Memory · Row Drift · 10 pairs',
	'leaderboard.memory.decay.6': 'Memory · Fading Clue · 6 pairs',
	'leaderboard.memory.decay.8': 'Memory · Fading Clue · 8 pairs',
	'leaderboard.memory.decay.10': 'Memory · Fading Clue · 10 pairs',
	'leaderboard.memory.one-flip.6': 'Memory · One Flip · 6 pairs',
	'leaderboard.memory.one-flip.8': 'Memory · One Flip · 8 pairs',
	'leaderboard.memory.one-flip.10': 'Memory · One Flip · 10 pairs',
	'leaderboard.memory.combo.6': 'Memory · Combo Multiplier · 6 pairs',
	'leaderboard.memory.combo.8': 'Memory · Combo Multiplier · 8 pairs',
	'leaderboard.memory.combo.10': 'Memory · Combo Multiplier · 10 pairs',
	'leaderboard.memory.hazard.6': 'Memory · Hazard Trap · 6 pairs',
	'leaderboard.memory.hazard.8': 'Memory · Hazard Trap · 8 pairs',
	'leaderboard.memory.hazard.10': 'Memory · Hazard Trap · 10 pairs',
	'leaderboard.memory6': 'Memory · 6 pairs',
	'leaderboard.memory8': 'Memory · 8 pairs',
	'leaderboard.memory10': 'Memory · 10 pairs',
	'game.title': 'Memory',
	'game.streak': 'Streak {count}',
	'game.hint': '{pairs} pairs · Find the matching pairs',
	'status.match': 'Match',
	'status.mismatch': 'Not a match',
	'status.won': 'All pairs found',
	'status.memorize': 'Memorize the pairs',
	'status.go': 'Go',
	'card.down': 'Card {number}, face down',
	'card.up': 'Card {number}, {symbol}',
	'card.matched': '{symbol}, matched',
	'symbol.circle': 'circle',
	'symbol.triangle': 'triangle',
	'symbol.square': 'square',
	'symbol.diamond': 'diamond',
	'symbol.star': 'star',
	'symbol.hexagon': 'hexagon',
	'symbol.cross': 'cross',
	'symbol.ring': 'ring',
	'symbol.pentagon': 'pentagon',
	'symbol.heart': 'heart',
	'result.title': 'All pairs found',
	'result.summary': '{pairs} pairs · {moves} moves · {time}'
} as const;
