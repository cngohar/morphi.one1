"""Independent Python reference for SplitMix64/Memory fixture generation.
Block's expected values are the existing, pre-refactor known test vector.
Run manually with python3 tests/vectors/reference.py; review changes as a rules change.
"""
import json
from pathlib import Path
MASK = (1 << 64) - 1
class RNG:
    def __init__(self, seed): self.state = int(seed)
    def draw(self):
        self.state = (self.state + 0x9e3779b97f4a7c15) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * 0xbf58476d1ce4e5b9) & MASK
        z = ((z ^ (z >> 27)) * 0x94d049bb133111eb) & MASK
        return (z ^ (z >> 31)) & MASK
    def integer(self, n):
        limit = (1 << 64) - ((1 << 64) % n)
        value = self.draw()
        while value >= limit: value = self.draw()
        return value % n
    def shuffle(self, values):
        result = list(values)
        for index in range(len(result)-1, 0, -1):
            other = self.integer(index+1)
            result[index], result[other] = result[other], result[index]
        return result
symbols = ['circle','triangle','square','diamond','star','hexagon','cross','ring','pentagon','heart']
memory = []
for seed in ['0','42','18446744073709551615']:
    rng = RNG(seed)
    pairs = [6,8,10][rng.integer(3)]
    selected = rng.shuffle(symbols)[:pairs]
    deck = rng.shuffle([f'{symbol}:{copy}' for symbol in selected for copy in [0,1]])
    memory.append({'seed':seed,'pairs':pairs,'deck':deck,'score':pairs*1000-50})
fixture = {'rng':['e220a8397b1dcdaf','6e789e6aa1b965f4','6c45d188009454f','f88bb8a8724c81ec','1b39896a51a8749b'], 'memory':memory, 'block': {'score':700,'lines':5,'combo':0,'placements':20,'status':'playing','supplyIndex':21,'tray':[None,None,'single']}}
Path('tests/vectors/reference.json').write_text(json.dumps(fixture,indent=2)+'\n')
