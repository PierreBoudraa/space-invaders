"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const GAME_WIDTH = 400;
const GAME_HEIGHT = 500;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 20;
const INVADER_SIZE = 30;
const INVADER_ROWS = 3;
const INVADER_COLS = 6;
const BULLET_SPEED = 8;
const BASE_INVADER_SPEED = 0.4;
const INVADER_MOVE_EVERY_N_TICKS = 4;
const SHOOT_COOLDOWN_MS = 350;

// Les 3 classes de monstres : vitesse (multiplicateur), points, emoji
type InvaderType = "normal" | "fast" | "ultra";

const INVADER_CONFIG: Record<InvaderType, { speedMultiplier: number; points: number; emoji: string }> = {
  normal: { speedMultiplier: 5, points: 10, emoji: "👾" },
  fast: { speedMultiplier: 10, points: 20, emoji: "👹" },
  ultra: { speedMultiplier: 20, points: 40, emoji: "💀" },
};

type Entity = { x: number; y: number; type: InvaderType };
type Bullet = { x: number; y: number; id: number };

export default function Home() {
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [invaders, setInvaders] = useState<Entity[]>([]);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  const bulletIdRef = useRef(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const invaderDirectionRef = useRef(1);
  const tickCountRef = useRef(0);
  const lastShotRef = useRef(0);
  const playerXRef = useRef(playerX);
  const waveRef = useRef(wave);

  const bulletsRef = useRef<Bullet[]>([]);
  const invadersRef = useRef<Entity[]>([]);

  playerXRef.current = playerX;
  waveRef.current = wave;

  useEffect(() => {
    bulletsRef.current = bullets;
  }, [bullets]);

  useEffect(() => {
    invadersRef.current = invaders;
  }, [invaders]);

  // Choisit un type de monstre au hasard, avec des probabilités qui évoluent selon la vague
  const pickInvaderType = useCallback((currentWave: number): InvaderType => {
    const roll = Math.random();
    // Plus la vague avance, plus les monstres rapides/ultra sont fréquents
    const ultraChance = Math.min(0.05 + currentWave * 0.03, 0.35);
    const fastChance = Math.min(0.15 + currentWave * 0.04, 0.45);

    if (roll < ultraChance) return "ultra";
    if (roll < ultraChance + fastChance) return "fast";
    return "normal";
  }, []);

  const initInvaders = useCallback(
    (currentWave: number): Entity[] => {
      const newInvaders: Entity[] = [];
      for (let row = 0; row < INVADER_ROWS; row++) {
        for (let col = 0; col < INVADER_COLS; col++) {
          newInvaders.push({
            x: col * (INVADER_SIZE + 15) + 30,
            y: row * (INVADER_SIZE + 15) + 30,
            type: pickInvaderType(currentWave),
          });
        }
      }
      return newInvaders;
    },
    [pickInvaderType]
  );

  useEffect(() => {
    const initial = initInvaders(1);
    setInvaders(initial);
    invadersRef.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === " ") {
        e.preventDefault();
        const now = Date.now();
        if (now - lastShotRef.current >= SHOOT_COOLDOWN_MS) {
          lastShotRef.current = now;
          const newBullet = {
            id: bulletIdRef.current++,
            x: playerXRef.current + PLAYER_WIDTH / 2 - 2,
            y: GAME_HEIGHT - 50,
          };
          bulletsRef.current = [...bulletsRef.current, newBullet];
          setBullets(bulletsRef.current);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (isGameOver) return;

    const loop = setInterval(() => {
      if (keysPressed.current.has("ArrowLeft")) {
        setPlayerX((x) => Math.max(0, x - 5));
      }
      if (keysPressed.current.has("ArrowRight")) {
        setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_WIDTH, x + 5));
      }

      const movedBullets = bulletsRef.current
        .map((b) => ({ ...b, y: b.y - BULLET_SPEED }))
        .filter((b) => b.y > 0);

      tickCountRef.current++;
      let movedInvaders = invadersRef.current;

      if (tickCountRef.current % INVADER_MOVE_EVERY_N_TICKS === 0) {
        const hitEdge = invadersRef.current.some(
          (inv) =>
            (invaderDirectionRef.current === 1 &&
              inv.x + INVADER_SIZE >= GAME_WIDTH) ||
            (invaderDirectionRef.current === -1 && inv.x <= 0)
        );

        if (hitEdge) {
          invaderDirectionRef.current *= -1;
          movedInvaders = invadersRef.current.map((inv) => ({
            ...inv,
            y: inv.y + 12,
          }));
        } else {
          // Chaque type de monstre bouge à sa propre vitesse (speedMultiplier)
          const baseSpeed = BASE_INVADER_SPEED + waveRef.current * 0.15;
          movedInvaders = invadersRef.current.map((inv) => ({
            ...inv,
            x:
              inv.x +
              invaderDirectionRef.current *
                baseSpeed *
                INVADER_CONFIG[inv.type].speedMultiplier,
          }));
        }
      }

      let finalInvaders = movedInvaders;
      const finalBullets: Bullet[] = [];

      movedBullets.forEach((bullet) => {
        const hitIndex = finalInvaders.findIndex(
          (inv) =>
            bullet.x < inv.x + INVADER_SIZE &&
            bullet.x + 4 > inv.x &&
            bullet.y < inv.y + INVADER_SIZE &&
            bullet.y > inv.y
        );

        if (hitIndex !== -1) {
          const killedType = finalInvaders[hitIndex].type;
          finalInvaders = finalInvaders.filter((_, i) => i !== hitIndex);
          setScore((s) => s + INVADER_CONFIG[killedType].points);
        } else {
          finalBullets.push(bullet);
        }
      });

      if (finalInvaders.length === 0) {
        const nextWave = waveRef.current + 1;
        const newInvaders = initInvaders(nextWave);
        invadersRef.current = newInvaders;
        bulletsRef.current = finalBullets;
        setInvaders(newInvaders);
        setBullets(finalBullets);
        setWave(nextWave);
        return;
      }

      bulletsRef.current = finalBullets;
      invadersRef.current = finalInvaders;
      setBullets(finalBullets);
      setInvaders(finalInvaders);

      if (finalInvaders.some((inv) => inv.y + INVADER_SIZE >= GAME_HEIGHT - 60)) {
        setIsGameOver(true);
      }
    }, 16);

    return () => clearInterval(loop);
  }, [isGameOver, initInvaders]);

  const handleRestart = () => {
    setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
    setBullets([]);
    bulletsRef.current = [];
    const newInvaders = initInvaders(1);
    setInvaders(newInvaders);
    invadersRef.current = newInvaders;
    invaderDirectionRef.current = 1;
    tickCountRef.current = 0;
    setScore(0);
    setWave(1);
    setIsGameOver(false);
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 font-mono">
      <div className="flex items-center gap-6">
        <p className="text-[#39ff14] text-xl">SCORE: {score}</p>
        <p className="text-[#ffe66d] text-sm">VAGUE {wave}</p>
      </div>

      <div
        className="relative bg-[#0a0a0a] border-2 border-[#39ff14]/30 overflow-hidden"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        <div
          className="absolute bg-[#39ff14]"
          style={{
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            left: playerX,
            bottom: 20,
            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          }}
        />

        {bullets.map((b) => (
          <div
            key={b.id}
            className="absolute bg-[#ffe66d]"
            style={{ width: 4, height: 12, left: b.x, top: b.y }}
          />
        ))}

        {invaders.map((inv, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center text-xl"
            style={{
              width: INVADER_SIZE,
              height: INVADER_SIZE,
              left: inv.x,
              top: inv.y,
            }}
          >
            {INVADER_CONFIG[inv.type].emoji}
          </div>
        ))}

        {isGameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2">
            <p className="text-[#ff2e63] text-xl">GAME OVER</p>
            <p className="text-white/60 text-sm">
              Score final : {score} — Vague atteinte : {wave}
            </p>
            <button
              onClick={handleRestart}
              className="px-4 py-2 bg-[#39ff14] text-black text-sm hover:bg-[#2fc082] transition-colors mt-2"
            >
              REJOUER
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 text-xs text-white/40">
        <span>👾 Normal (10pts)</span>
        <span>👹 Rapide (20pts)</span>
        <span>💀 Ultra-rapide (40pts)</span>
      </div>

      <p className="text-[#39ff14]/50 text-xs">← → POUR BOUGER, ESPACE POUR TIRER</p>
    </main>
  );
}