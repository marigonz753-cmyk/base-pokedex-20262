import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface NamedResource { name: string; url: string }
interface DexEntry extends NamedResource { id: number }
interface SpriteSet { front_default?: string | null; front_transparent?: string | null }

export interface PokemonData {
  id: number;
  name: string;
  weight: number;
  height: number;
  stats: { base_stat: number; stat: NamedResource }[];
  types: { type: NamedResource }[];
  abilities: { ability: NamedResource }[];
  moves: { move: NamedResource }[];
  species?: NamedResource;
  cries?: { legacy?: string; latest?: string };
  sprites?: {
    front_default?: string | null;
    other?: { 'official-artwork'?: SpriteSet };
    versions?: Record<string, Record<string, SpriteSet | undefined>>;
  };
}

interface EvolutionNode { species: { name: string }; evolves_to: EvolutionNode[] }
interface SpeciesData { generation?: { name: string }; evolution_chain?: { url: string } }
interface MoveInfo { name: string; pp: string; type: string }
interface DialogState { line1: string; line2: string; showArrow: boolean; instant: boolean; id: number }
type DialogPage = [string, string];
type Phase = 'search' | 'found' | 'sendout' | 'menu' | 'viewing-info' | 'viewing-species' | 'moves';

export interface PokeSearchAssets {
  sceneBg: string;
  foundBg: string;
  grassTop: string;
  grassBottom: string;
  playerSprite: string;
  trainer: string;
  trainerStill: string;
  battleCry: string;
  battleMusic: string;
  battleMusicLoop: string;
  confirmSound: string;
  escapeSound: string;
}

export interface PokeSearchProps {
  /** Override any of the image / audio asset URLs. */
  assets?: Partial<PokeSearchAssets>;
  /** Name of the player's Pokémon shown in the battle dialog. */
  partnerName?: string;
  /** Level shown on the wild Pokémon's HUD. */
  enemyLevel?: number;
  className?: string;
  /** Fired once a Pokémon has been fetched and the encounter starts. */
  onFound?: (pokemon: PokemonData) => void;
  /** Rendered after the game UI (e.g. extra overlays). */
  children?: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const API = 'https://pokeapi.co/api/v2';
const SEND_OUT_HOLD_MS = 2200;

const DEFAULT_ASSETS: PokeSearchAssets = {
  sceneBg: 'background.jpg',
  foundBg: 'battle-bg.jpg',
  grassTop: 'grass-top.png',
  grassBottom: 'grass-bottom.png',
  playerSprite: 'mightyenaback.png',
  trainer: 'trainer.gif',
  trainerStill: 'trainerstill.jpg',
  battleCry: 'MightyenaCry.mp3',
  battleMusic: 'BattleMusic.mp3',
  battleMusicLoop: 'BattleMusicLoop.mp3',
  confirmSound: 'ConfirmSound.mp3',
  escapeSound: 'Escape.mp3',
};

const MENU_ITEMS = [
  { row: 0, col: 0, label: 'INFO' },
  { row: 0, col: 1, label: 'SPECIES' },
  { row: 1, col: 0, label: 'MOVES' },
  { row: 1, col: 1, label: 'BACK' },
] as const;
type MenuAction = (typeof MENU_ITEMS)[number]['label'];

const CONTROLS = [
  { key: 'ARROW KEYS', action: 'MOVE' },
  { key: 'Z', action: 'SELECT' },
  { key: 'X', action: 'RETURN' },
];

const TYPE_RINGS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
};

const EARLIEST_SPRITES: [string, string[]][] = [
  ['generation-i', ['red-blue', 'yellow']],
  ['generation-ii', ['gold', 'silver', 'crystal']],
  ['generation-iv', ['diamond-pearl', 'platinum', 'heartgold-soulsilver']],
  ['generation-v', ['black-white']],
  ['generation-vi', ['x-y', 'omegaruby-alphasapphire']],
  ['generation-vii', ['ultra-sun-ultra-moon']],
  ['generation-viii', []],
];

const EMPTY_MOVE: MoveInfo = { name: '-', pp: '--/--', type: '----' };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

const playAudio = (a: HTMLAudioElement | null) => {
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ }
};

const stopAudio = (a: HTMLAudioElement | null) => {
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch { /* ignore */ }
};

function matchDex(dex: DexEntry[], term: string): DexEntry[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const starts: DexEntry[] = [];
  const has: DexEntry[] = [];
  for (const p of dex) {
    if (p.name.startsWith(q)) starts.push(p);
    else if (p.name.includes(q)) has.push(p);
    if (starts.length >= 8) break;
  }
  return [...starts, ...has].slice(0, 8);
}

/** Gen 3 first, then the earliest appearance, then the default sprite. */
function pickEnemySprite(pokemon: PokemonData): string {
  const versions = pokemon.sprites?.versions ?? {};
  const gen3 = versions['generation-iii'] ?? {};
  for (const game of ['emerald', 'firered-leafgreen', 'ruby-sapphire']) {
    const url = gen3[game]?.front_default;
    if (url) return url;
  }
  for (const [genKey, games] of EARLIEST_SPRITES) {
    const gen = versions[genKey];
    if (!gen) continue;
    const order = [...games, ...Object.keys(gen).filter((g) => !games.includes(g) && g !== 'icons')];
    for (const game of order) {
      const url = gen[game]?.front_transparent || gen[game]?.front_default;
      if (url) return url;
    }
  }
  return (
    pokemon.sprites?.front_default ||
    pokemon.sprites?.other?.['official-artwork']?.front_default ||
    ''
  );
}

function findNode(node: EvolutionNode, name: string): EvolutionNode | null {
  if (node.species.name === name) return node;
  for (const child of node.evolves_to) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

async function fetchMoves(pokemon: PokemonData): Promise<MoveInfo[]> {
  const list = await Promise.all(
    pokemon.moves.slice(0, 4).map(async ({ move }): Promise<MoveInfo> => {
      const info: MoveInfo = { name: move.name.replace(/-/g, ' ').toUpperCase(), pp: '--/--', type: '----' };
      try {
        const res = await fetch(move.url);
        if (res.ok) {
          const d: { pp?: number; type?: NamedResource } = await res.json();
          info.pp = d.pp ? `${d.pp}/${d.pp}` : '20/20';
          info.type = d.type ? d.type.name.toUpperCase() : 'NORMAL';
        }
      } catch { /* keep placeholders */ }
      return info;
    }),
  );
  while (list.length < 4) list.push({ ...EMPTY_MOVE });
  return list;
}

async function fetchSpecies(pokemon: PokemonData) {
  const out: { species: SpeciesData | null; evoChain: EvolutionNode | null } = { species: null, evoChain: null };
  if (!pokemon.species?.url) return out;
  const res = await fetch(pokemon.species.url);
  if (!res.ok) return out;
  out.species = await res.json();
  const evoUrl = out.species?.evolution_chain?.url;
  if (evoUrl) {
    const evoRes = await fetch(evoUrl);
    if (evoRes.ok) out.evoChain = (await evoRes.json()).chain;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

interface EnemyHudProps { name: string; level: number }

function EnemyHud({ name, level }: EnemyHudProps) {
  return (
    <div className="enemy-hud">
      <div className="hud-top">
        <span className="enemy-name">{name}</span>
        <span className="enemy-lvl">Lv{level}</span>
      </div>
      <div className="hud-hp-container">
        <span className="hp-label">HP</span>
        <div className="hp-bar-bg"><div className="hp-bar-fill" /></div>
      </div>
    </div>
  );
}

interface ControlsWindowProps { open: boolean; onClose: () => void }

function ControlsWindow({ open, onClose }: ControlsWindowProps) {
  return (
    <div
      className={cx('controls-backdrop', open && 'open')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="controls-window" role="dialog" aria-label="Controls">
        <h2>CONTROLS</h2>
        {CONTROLS.map((c) => (
          <div className="controls-row" key={c.key}>
            <span className="key">{c.key}</span>
            <span>{c.action}</span>
          </div>
        ))}
        <p className="controls-hint">X TO CLOSE</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function PokeSearch({
  assets,
  partnerName = 'Mightyena',
  enemyLevel = 25,
  className,
  onFound,
  children,
}: PokeSearchProps) {
  const a = { ...DEFAULT_ASSETS, ...assets };
  const partner = partnerName.toUpperCase();
  const listId = useId();

  // search
  const [dex, setDex] = useState<DexEntry[]>([]);
  const [query, setQuery] = useState('');
  const [hints, setHints] = useState<DexEntry[]>([]);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [hintCursor, setHintCursor] = useState(-1);
  const [status, setStatus] = useState('Loading the Pokédex…');
  const [busy, setBusy] = useState(false);

  // encounter
  const [phase, setPhase] = useState<Phase>('search');
  const [fading, setFading] = useState(false);
  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [species, setSpecies] = useState<SpeciesData | null>(null);
  const [evoChain, setEvoChain] = useState<EvolutionNode | null>(null);
  const [moves, setMoves] = useState<MoveInfo[]>([]);
  const [enemySrc, setEnemySrc] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ line1: '', line2: '', showArrow: true, instant: false, id: 0 });
  const [menuPos, setMenuPos] = useState({ row: 0, col: 0 });
  const [infoPages, setInfoPages] = useState<DialogPage[]>([]);
  const [infoIdx, setInfoIdx] = useState(0);
  const [moveIdx, setMoveIdx] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const battleCry = useRef<HTMLAudioElement>(null);
  const wildCry = useRef<HTMLAudioElement>(null);
  const battleMusic = useRef<HTMLAudioElement>(null);
  const battleMusicLoop = useRef<HTMLAudioElement>(null);
  const confirmSound = useRef<HTMLAudioElement>(null);
  const escapeSound = useRef<HTMLAudioElement>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});

  const say = (line1: string, line2 = '', showArrow = true, instant = false) =>
    setDialog((d) => ({ line1, line2, showArrow, instant, id: d.id + 1 }));
  const askMenu = () => say('What will', `${partner} do?`, false, true);

  /* ---------------- data loading & lifecycle ---------------- */

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(`${API}/pokemon?limit=100000&offset=0`);
        if (!res.ok) throw new Error(String(res.status));
        const data: { results: NamedResource[] } = await res.json();
        if (dead) return;
        const entries = data.results.map((p) => ({
          ...p,
          id: Number(p.url.split('/').filter(Boolean).pop()),
        }));
        setDex(entries);
        setStatus(`${entries.length} Pokémon ready.`);
      } catch {
        if (!dead) setStatus('Could not reach the PokéAPI. Check your connection and reload.');
      }
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (battleMusic.current) battleMusic.current.volume = 0.8;
    if (battleMusicLoop.current) battleMusicLoop.current.volume = 0.8;
    return () => { clearTimeout(sendTimer.current); clearTimeout(resetTimer.current); };
  }, []);

  useEffect(() => {
    listRef.current?.children[hintCursor]?.scrollIntoView({ block: 'nearest' });
  }, [hintCursor]);

  // Close suggestions when clicking outside the search block.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setHintsOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Controls window owns the keyboard while open.
  useEffect(() => {
    if (!controlsOpen) return;
    inputRef.current?.blur();
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'x' || e.key === 'X' || e.key === 'Escape') setControlsOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [controlsOpen]);

  // Game keyboard handling (handler is refreshed every render, registered once).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- search ---------------- */

  const onQueryChange = (value: string) => {
    const list = matchDex(dex, value);
    setQuery(value);
    setHints(list);
    setHintCursor(-1);
    setHintsOpen(list.length > 0);
    setStatus(value.trim() && !list.length ? 'No Pokémon matches that name.' : `${dex.length} Pokémon ready.`);
  };

  const moveHint = (step: number) => {
    if (!hintsOpen || !hints.length) return;
    const next = hintCursor === -1
      ? (step > 0 ? 0 : hints.length - 1)
      : (hintCursor + step + hints.length) % hints.length;
    setHintCursor(next);
    setQuery(hints[next].name);
  };

  const pickHint = (name: string) => {
    setQuery(name);
    setHintsOpen(false);
    inputRef.current?.focus();
  };

  const submit = async () => {
    const name = query.trim().toLowerCase();
    if (!name) return;
    setHintsOpen(false);
    setBusy(true);
    setStatus('Searching…');
    try {
      const res = await fetch(`${API}/pokemon/${encodeURIComponent(name)}`);
      if (res.status === 404) { setStatus(`No Pokémon called "${name}".`); return; }
      if (!res.ok) throw new Error(String(res.status));
      const data: PokemonData = await res.json();
      const [moveList, speciesBundle] = await Promise.all([fetchMoves(data), fetchSpecies(data)]);

      setPokemon(data);
      setMoves(moveList);
      setSpecies(speciesBundle.species);
      setEvoChain(speciesBundle.evoChain);
      document.dispatchEvent(new CustomEvent('pokesearch:found', { detail: data }));
      onFound?.(data);

      setPhase('found');
      playAudio(battleMusic.current);

      const formatted = data.name.charAt(0).toUpperCase() + data.name.slice(1);
      say(`Wild ${formatted} appeared!`, '', true);
      setEnemySrc(pickEnemySprite(data));

      const cryUrl = data.cries?.legacy || data.cries?.latest || '';
      if (wildCry.current && cryUrl) {
        wildCry.current.src = cryUrl;
        playAudio(wildCry.current);
      }
      setStatus(`Found #${data.id} ${data.name}.`);
    } catch {
      setStatus('Search failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- battle flow ---------------- */

  const sendOut = () => {
    setPhase('sendout');
    say(`Go, ${partnerName}!`, '', false);
    playAudio(battleCry.current);
    clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => {
      setPhase('menu');
      setMenuPos({ row: 0, col: 0 });
      askMenu();
    }, SEND_OUT_HOLD_MS);
  };

  const goBack = () => {
    clearTimeout(sendTimer.current);
    playAudio(escapeSound.current);
    [battleCry, wildCry, battleMusic, battleMusicLoop].forEach((r) => stopAudio(r.current));
    setFading(true);
    resetTimer.current = setTimeout(() => {
      setFading(false);
      setPhase('search');
      say('Wild appeared!', '', true, true);
      setPokemon(null);
      setEnemySrc('');
      setMenuPos({ row: 0, col: 0 });
      if (dex.length) setStatus(`${dex.length} Pokémon ready.`);
      requestAnimationFrame(() => inputRef.current?.focus());
    }, 200);
  };

  const openPages = (target: 'viewing-info' | 'viewing-species', pages: DialogPage[]) => {
    setPhase(target);
    setInfoPages(pages);
    setInfoIdx(0);
    say(pages[0][0], pages[0][1], pages.length > 1);
  };

  const showInfo = () => {
    if (!pokemon) return;
    const stats = pokemon.stats.map((s) => `${s.stat.name.toUpperCase()}: ${s.base_stat}`);
    const pages: DialogPage[] = [[
      `Wt: ${(pokemon.weight / 10).toFixed(1)}kg Ht: ${(pokemon.height / 10).toFixed(1)}m`,
      stats[0] ?? '',
    ]];
    for (let i = 1; i < stats.length; i += 2) pages.push([stats[i] ?? '', stats[i + 1] ?? '']);
    openPages('viewing-info', pages);
  };

  const showSpecies = () => {
    if (!pokemon || !species) return;
    const types = pokemon.types.map((t) => t.type.name.toUpperCase()).join(' ');
    const abilities = pokemon.abilities.map((x) => x.ability.name.toUpperCase()).join(' ');
    const gen = species.generation
      ? species.generation.name.replace('generation-', '').toUpperCase()
      : 'NONE';
    const evos = (evoChain ? findNode(evoChain, pokemon.name)?.evolves_to ?? [] : [])
      .map((e) => e.species.name.toUpperCase());
    openPages('viewing-species', [
      [`Type: ${types}`, `Abilities: ${abilities}`],
      [`Evo: ${evos.length ? evos.join(' ') : 'NONE'}`, `Gen: ${gen}`],
    ]);
  };

  const showMoves = () => {
    setPhase('moves');
    setMoveIdx(0);
    setDialog((d) => ({ ...d, showArrow: false }));
  };

  const runAction = (action: MenuAction) => {
    if (action === 'BACK') goBack();
    else if (action === 'INFO') showInfo();
    else if (action === 'SPECIES') showSpecies();
    else showMoves();
  };

  keyHandler.current = (e) => {
    if (document.activeElement === inputRef.current || phase === 'sendout') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const confirm = k === 'z' || k === 'Enter';

    if (phase === 'moves') {
      if (k === 'ArrowUp') { e.preventDefault(); if (moveIdx >= 2) setMoveIdx(moveIdx - 2); }
      else if (k === 'ArrowDown') { e.preventDefault(); if (moveIdx <= 1) setMoveIdx(moveIdx + 2); }
      else if (k === 'ArrowLeft') { e.preventDefault(); if (moveIdx % 2 === 1) setMoveIdx(moveIdx - 1); }
      else if (k === 'ArrowRight') { e.preventDefault(); if (moveIdx % 2 === 0) setMoveIdx(moveIdx + 1); }
      else if (confirm) e.preventDefault(); // moves are view-only
      else if (k === 'Escape' || k === 'x' || k === 'Backspace') {
        e.preventDefault();
        playAudio(confirmSound.current);
        setPhase('menu');
        askMenu();
      }
      return;
    }

    if (phase === 'viewing-info' || phase === 'viewing-species') {
      if (k !== 'z') return;
      e.preventDefault();
      playAudio(confirmSound.current);
      if (infoIdx < infoPages.length - 1) {
        const next = infoIdx + 1;
        setInfoIdx(next);
        say(infoPages[next][0], infoPages[next][1], next < infoPages.length - 1);
      } else {
        setPhase('menu');
        askMenu();
      }
      return;
    }

    if (phase === 'found') {
      if (k === 'z') { e.preventDefault(); playAudio(confirmSound.current); sendOut(); }
      return;
    }

    if (phase !== 'menu') return;
    if (k === 'ArrowUp') { e.preventDefault(); setMenuPos((p) => ({ ...p, row: Math.max(0, p.row - 1) })); }
    else if (k === 'ArrowDown') { e.preventDefault(); setMenuPos((p) => ({ ...p, row: Math.min(1, p.row + 1) })); }
    else if (k === 'ArrowLeft') { e.preventDefault(); setMenuPos((p) => ({ ...p, col: Math.max(0, p.col - 1) })); }
    else if (k === 'ArrowRight') { e.preventDefault(); setMenuPos((p) => ({ ...p, col: Math.min(1, p.col + 1) })); }
    else if (confirm) {
      e.preventDefault();
      playAudio(confirmSound.current);
      const item = MENU_ITEMS.find((m) => m.row === menuPos.row && m.col === menuPos.col);
      if (item) runAction(item.label);
    }
  };

  /* ---------------- render ---------------- */

  const sceneClass = cx(
    'scene',
    phase !== 'search' && 'found',
    phase !== 'search' && phase !== 'found' && phase,
    fading && 'fading',
  );
  const rootStyle = {
    '--scene-bg': `url("${a.sceneBg}")`,
    '--found-bg': `url("${a.foundBg}")`,
  } as CSSProperties;
  const enemyName = pokemon ? pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1) : '';
  const currentMove: MoveInfo | undefined = moves[moveIdx];
  const patches = [
    { key: 'top', className: 'patch patch-top', src: a.grassTop },
    { key: 'bottom', className: 'patch patch-bottom', src: a.grassBottom },
  ];

  return (
    <div className={cx('ps-root', className)} style={rootStyle}>
      <style>{STYLES}</style>

      <main className={sceneClass}>
        <div className="fade-overlay" />
        <div className="parallax" aria-hidden="true"><span /><span /></div>

        <EnemyHud name={enemyName} level={enemyLevel} />

        {patches.map((p) => <img key={p.key} className={p.className} src={p.src} alt="" />)}

        <img className="enemy-sprite" src={enemySrc || undefined} alt={enemyName} />
        <img className="player-sprite" src={a.playerSprite} alt={`${partnerName}.`} />
        <img className="trainer" src={a.trainer} data-still={a.trainerStill} alt="Pokemon trainer." />

        <div className="exclaim" hidden>
          <div className="bubble"><span className="mark">!</span></div>
        </div>

        <div className="battle-dialog">
          <div className="dialog-text-container">
            <span key={`l1-${dialog.id}`} className={cx('typewriter-text', dialog.instant && 'instant')}>
              {dialog.line1}
            </span>
            <span
              key={`l2-${dialog.id}`}
              className={cx('typewriter-text', dialog.instant && 'instant')}
              style={{ animationDelay: '0.5s' }}
            >
              {dialog.line2}
            </span>
          </div>
          {dialog.showArrow && <span className="dialog-arrow">▼</span>}
          <div className="moves-grid">
            {[0, 1, 2, 3].map((i) => {
              const mv = moves[i];
              const ring = (mv && TYPE_RINGS[mv.type.toLowerCase()]) || 'var(--menu-border)';
              return (
                <div
                  key={i}
                  className="move-box"
                  style={{ '--ring': ring } as CSSProperties}
                  aria-selected={i === moveIdx}
                >
                  {mv ? mv.name : '-'}
                </div>
              );
            })}
          </div>
        </div>

        <audio ref={battleCry} preload="auto" src={a.battleCry} />
        <audio ref={wildCry} preload="auto" />
        <audio
          ref={battleMusic}
          preload="auto"
          src={a.battleMusic}
          onEnded={() => playAudio(battleMusicLoop.current)}
        />
        <audio ref={battleMusicLoop} preload="auto" src={a.battleMusicLoop} loop />
        <audio ref={confirmSound} preload="auto" src={a.confirmSound} />
        <audio ref={escapeSound} preload="auto" src={a.escapeSound} />

        <div className="battle-menu commands" role="listbox" aria-label="Battle commands">
          {MENU_ITEMS.map((item) => (
            <div
              key={item.label}
              className="menu-item"
              role="option"
              aria-selected={item.row === menuPos.row && item.col === menuPos.col}
              onClick={() => { setMenuPos({ row: item.row, col: item.col }); runAction(item.label); }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="battle-menu moves-info">
          <div className="move-details-row">
            <span>PP</span>
            <span>{currentMove ? currentMove.pp : '--/--'}</span>
          </div>
          <div>{`TYPE/${currentMove ? currentMove.type : '----'}`}</div>
        </div>

        <section className="search" ref={searchRef}>
          <h1 className="wordmark">PokeSearch</h1>

          <div className="field">
            <input
              ref={inputRef}
              className="query"
              type="text"
              placeholder="Type a Pokémon name"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={hintsOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); moveHint(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); moveHint(-1); }
                else if (e.key === 'Enter') { e.preventDefault(); submit(); }
                else if (e.key === 'Escape') setHintsOpen(false);
              }}
            />
            <button className="go" type="button" disabled={busy || !query.trim()} onClick={submit}>
              Search
            </button>
          </div>

          <ul ref={listRef} className="hints" id={listId} role="listbox" hidden={!hintsOpen}>
            {hints.map((p, i) => (
              <li key={p.name} role="option" aria-selected={i === hintCursor} onClick={() => pickHint(p.name)}>
                <span className="num">#{String(p.id).padStart(4, '0')}</span>
                {p.name.replace(/-/g, ' ')}
              </li>
            ))}
          </ul>
          <p className="status" role="status">{status}</p>
        </section>
      </main>

      <button
        className="controls-btn"
        type="button"
        onClick={(e) => { setControlsOpen((o) => !o); e.currentTarget.blur(); }}
      >
        CONTROLS
      </button>
      <ControlsWindow open={controlsOpen} onClose={() => setControlsOpen(false)} />

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles (scoped under .ps-root via CSS nesting)                      */
/* ------------------------------------------------------------------ */

const STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");
.ps-root{
  --bg-zoom:700%;--bg-lift:-55%;--bg-speed:32s;
  --dialog-bg:#6f8fa0;--hud-bg:#f6edc2;--hud-ink:#33334a;
  --menu-bg:#fbfbfb;--menu-border:#6d6da8;--menu-edge:#2a2a44;--menu-ink:#30304e;
  --ink:#2a2f4a;--frame:#c4443c;--field:#5a8f8f;--field-in:#4a7d7d;--sky:#7fc8e8;--grass:#6bbf5a;
  min-height:100svh;display:grid;place-items:center;background:#000;color:#fff;
  font-family:"Press Start 2P",ui-monospace,monospace;image-rendering:pixelated;
  &,& *{box-sizing:border-box}

  .scene{position:relative;width:100%;max-width:936px;aspect-ratio:468/254;overflow:hidden;
    background:linear-gradient(var(--sky) 0 36%,#5aa6cf 36% 41%,var(--grass) 41% 100%);image-rendering:pixelated}
  .fade-overlay{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:1000;transition:opacity .2s ease-in-out}
  .scene.fading .fade-overlay{opacity:1;pointer-events:auto}
  .scene.fading > *:not(.fade-overlay){display:none!important}

  .parallax{position:absolute;left:0;top:var(--bg-lift);width:calc(var(--bg-zoom)*2);height:175%;display:flex;z-index:0;will-change:transform;animation:ps-pan var(--bg-speed) linear infinite}
  .parallax span{flex:0 0 50%;background-image:var(--scene-bg);background-size:100% 100%;background-repeat:no-repeat;image-rendering:pixelated}

  .trainer{position:absolute;right:4%;bottom:6%;width:30%;max-width:260px;z-index:2;image-rendering:pixelated}
  .trainer:not([src]){height:52%;border:2px dashed rgba(255,255,255,.55);border-radius:4px}

  .scene.found{background-image:var(--found-bg);background-size:cover;background-position:center}
  .scene.found :is(.parallax,.trainer,.exclaim,.search){display:none}

  .exclaim{position:absolute;right:9%;top:6%;z-index:4}
  .exclaim[hidden]{display:none}
  .bubble{position:relative;width:38px;height:38px;background:#fff;border:3px solid var(--ink);border-radius:6px;box-shadow:2px 3px 0 rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
  .bubble::before,.bubble::after{content:"";position:absolute;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent}
  .bubble::before{bottom:-13px;border-top:11px solid var(--ink)}
  .bubble::after{bottom:-9px;border-top:9px solid #fff}
  .mark{font-family:"Press Start 2P",monospace;font-size:18px;color:#e0393e}

  .enemy-hud{position:absolute;top:8%;left:6%;width:300px;max-width:58%;background:var(--hud-bg);border:5px solid var(--hud-ink);border-radius:12px 12px 12px 21px;padding:12px 18px;color:var(--hud-ink);box-shadow:6px 6px 0 rgba(0,0,0,.3);z-index:3;opacity:0;transform:translateX(-40px);transition:transform .5s ease-out,opacity .5s ease-out}
  .scene.found .enemy-hud{opacity:1;transform:translateX(0)}
  .hud-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px;font-size:clamp(13px,2.1vw,18px)}
  .enemy-name{text-transform:capitalize;font-weight:bold}
  .enemy-lvl{font-size:clamp(12px,1.8vw,17px)}
  .hud-hp-container{display:flex;align-items:center;gap:9px}
  .hp-label{font-size:clamp(10px,1.5vw,14px);color:#c4443c;font-style:italic;font-weight:bold}
  .hp-bar-bg{flex:1;height:12px;background:#707070;border:3px solid var(--hud-ink);border-radius:6px;overflow:hidden;position:relative}
  .hp-bar-fill{width:100%;height:100%;background:linear-gradient(to bottom,#70f888 0%,#38a848 100%)}

  .patch{position:absolute;z-index:1;object-fit:contain;image-rendering:pixelated;opacity:0;transition:transform .5s ease-out,opacity .5s ease-out}
  .patch-top{top:32%;right:5%;width:72%;max-width:440px;aspect-ratio:3.7/1;transform:translateX(50px)}
  .patch-bottom{bottom:14%;left:-9%;width:800%;max-width:580px;aspect-ratio:3.9/1;transform:translateX(-50px)}
  .scene.found .patch{opacity:1;transform:translateX(0)}

  .enemy-sprite{position:absolute;top:4%;right:11%;width:30%;max-width:230px;z-index:2;image-rendering:pixelated;opacity:0;transform:translateY(12px);transition:transform .5s ease-out,opacity .5s ease-out;transition-delay:.15s}
  .scene.found .enemy-sprite{opacity:1;transform:translateY(0)}

  .battle-dialog{position:absolute;bottom:0;left:0;width:100%;height:30%;display:flex;align-items:center;background:var(--dialog-bg);border-top:6px solid var(--frame);border-bottom:6px solid var(--frame);padding:28px 30px;font-size:clamp(16px,3.6vw,28px);color:#fff;text-shadow:2px 2px 0 rgba(0,0,0,.35);z-index:5;box-shadow:inset 0 2px 0 rgba(0,0,0,.15);transform:translateY(100%);transition:transform .4s ease-out;transition-delay:.45s;overflow:hidden}
  .scene.found .battle-dialog{transform:translateY(0)}
  .dialog-text-container{position:relative;overflow:hidden;width:100%;display:flex;flex-direction:column;gap:8px}
  .typewriter-text{display:inline-block;overflow:hidden;white-space:nowrap;width:0;animation:ps-typing .5s steps(40,end) forwards}
  .typewriter-text.instant{width:100%!important;animation:none!important}
  .dialog-arrow{position:absolute;right:22px;bottom:18px;color:#fff;font-size:clamp(14px,2.4vw,18px);animation:ps-blink 1s infinite}

  .scene.menu .battle-dialog{width:52%;height:30%;border:6px solid var(--frame);border-radius:2px}
  .scene.menu .dialog-arrow,.scene.sendout .dialog-arrow{display:none}

  .battle-menu{position:absolute;right:0;bottom:0;width:48%;height:30%;background:var(--menu-bg);border:6px solid var(--menu-border);border-radius:4px;box-shadow:inset 0 0 0 3px var(--menu-bg),0 0 0 3px var(--menu-edge);display:none;grid-template-columns:1fr 1fr;align-content:center;gap:6px 4px;padding:22px 26px;z-index:6}
  .scene.menu .commands{display:grid}
  .menu-item{position:relative;display:flex;align-items:center;padding-left:26px;color:var(--menu-ink);font-size:clamp(14px,3vw,26px);letter-spacing:1px;line-height:1.4;cursor:pointer;user-select:none}
  .menu-item::before{content:"▶";position:absolute;left:0;font-size:.7em;color:var(--menu-ink);opacity:0}
  .menu-item[aria-selected="true"]::before{opacity:1}

  .scene.moves .battle-dialog{width:68%;height:30%;background:var(--menu-bg);border:6px solid var(--menu-border);border-radius:4px;box-shadow:inset 0 0 0 3px var(--menu-bg),0 0 0 3px var(--menu-edge);padding:10px 16px;align-items:stretch;z-index:6}
  .scene.moves .battle-dialog *{color:var(--menu-ink);text-shadow:none}
  .scene.moves .dialog-text-container,.scene.moves .dialog-arrow{display:none}
  .moves-grid{display:none;width:100%;height:100%;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px 14px}
  .scene.moves .moves-grid{display:grid}
  .move-box{position:relative;display:flex;align-items:center;min-width:0;padding:0 8px 0 30px;background:var(--menu-bg);border:4px solid var(--ring,var(--menu-border));border-radius:10px;font-size:clamp(9px,1.9vw,18px);line-height:1.2;white-space:nowrap;overflow:hidden;cursor:default;user-select:none}
  .move-box::before{content:"▶";position:absolute;left:9px;font-size:.7em;opacity:0}
  .move-box[aria-selected="true"]::before{opacity:1}
  .scene.moves .moves-info{display:flex;flex-direction:column;justify-content:center;gap:12px;width:32%;height:30%;padding:10px 22px;color:var(--menu-ink);font-size:clamp(9px,1.9vw,18px)}
  .move-details-row{display:flex;justify-content:space-between;align-items:baseline}

  .player-sprite{position:absolute;left:14%;bottom:29%;width:26%;max-width:210px;aspect-ratio:1/1;object-fit:contain;z-index:2;image-rendering:pixelated;display:none}
  .scene:is(.sendout,.menu,.viewing-info,.viewing-species,.moves) .player-sprite{display:block}
  .scene.sendout .player-sprite{animation:ps-send-in .5s ease-out both}
  .player-sprite:not([src]){border:2px dashed rgba(255,255,255,.45);border-radius:4px}

  .search{position:absolute;left:5%;top:14%;width:52%;z-index:3}
  .wordmark{margin:0 0 14px;font-size:clamp(14px,3.1vw,26px);letter-spacing:1px;text-align:center;color:#fff8d8;
    text-shadow:3px 0 var(--frame),-3px 0 var(--frame),0 3px var(--frame),0 -3px var(--frame),2px 2px var(--frame),-2px 2px var(--frame),2px -2px var(--frame),-2px -2px var(--frame),0 6px rgba(0,0,0,.28)}
  .field{position:relative;background:var(--field);border:4px solid var(--frame);border-radius:999px;box-shadow:inset 0 3px 0 rgba(0,0,0,.18),0 4px 0 rgba(0,0,0,.22);display:flex;align-items:center;padding:2px 6px}
  .field:focus-within{box-shadow:inset 0 3px 0 rgba(0,0,0,.18),0 0 0 3px #fff8d8,0 4px 0 rgba(0,0,0,.22)}
  .query{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:inherit;font-size:clamp(8px,1.5vw,13px);padding:14px 12px;caret-color:#fff8d8}
  .query::placeholder{color:rgba(255,255,255,.62)}
  .go{flex:0 0 auto;background:var(--frame);color:#fff8d8;border:0;border-radius:999px;font:inherit;font-size:clamp(7px,1.2vw,11px);padding:11px 14px;cursor:pointer}
  .go:hover{filter:brightness(1.1)}
  .go:disabled{opacity:.5;cursor:not-allowed}

  .hints{list-style:none;margin:8px 0 0;padding:4px;max-height:180px;overflow-y:auto;background:var(--field-in);border:4px solid var(--frame);border-radius:12px;box-shadow:0 4px 0 rgba(0,0,0,.22)}
  .hints[hidden]{display:none}
  .hints li{padding:9px 10px;font-size:clamp(7px,1.3vw,11px);border-radius:6px;cursor:pointer;text-transform:capitalize}
  .hints li[aria-selected="true"],.hints li:hover{background:var(--frame)}
  .hints .num{opacity:.65;margin-right:8px}
  .status{margin:8px 2px 0;font-size:clamp(6px,1.1vw,9px);line-height:1.7;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.35);min-height:1.2em}

  @media (max-width:560px){
    .search{position:static;width:auto;padding:18px}
    .scene{aspect-ratio:auto;min-height:100svh;display:flex;flex-direction:column;justify-content:center}
    .trainer{left:50%;transform:translateX(-50%);width:52%}
    .parallax{top:-10%;height:110%;--bg-zoom:260%}
  }

  .controls-btn{position:fixed;left:12px;bottom:12px;z-index:60;background:var(--menu-bg);color:var(--menu-ink);border:4px solid var(--menu-border);border-radius:4px;box-shadow:0 0 0 2px var(--menu-edge);font:inherit;font-size:10px;letter-spacing:1px;padding:8px 10px;cursor:pointer}
  .controls-btn:hover{filter:brightness(.94)}
  .controls-backdrop{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center}
  .controls-backdrop.open{display:flex}
  .controls-window{width:min(92vw,520px);background:var(--menu-bg);border:6px solid var(--menu-border);border-radius:4px;box-shadow:inset 0 0 0 3px var(--menu-bg),0 0 0 3px var(--menu-edge);color:var(--menu-ink);padding:24px 28px;font-size:clamp(9px,2.2vw,16px);line-height:1.6}
  .controls-window h2{margin:0 0 16px;font-size:1.15em;font-weight:normal;letter-spacing:1px}
  .controls-row{display:flex;justify-content:space-between;gap:16px;padding:6px 0}
  .controls-row .key{white-space:nowrap}
  .controls-hint{margin:16px 0 0;font-size:.75em;opacity:.7;text-align:right}
}
@keyframes ps-pan{from{transform:translate3d(-50%,0,0)}to{transform:translate3d(0,0,0)}}
@keyframes ps-typing{from{width:0}to{width:100%}}
@keyframes ps-blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes ps-send-in{from{transform:translateX(-220%);opacity:0}to{transform:translateX(0);opacity:1}}
@media (prefers-reduced-motion:reduce){
  .ps-root *{animation:none!important;transition:none!important}
  .ps-root .typewriter-text{width:100%}
}
`;
