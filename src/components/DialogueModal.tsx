import React, { useState, useEffect } from 'react';
import { NPCData, RomanceStage } from '../types/game';
import { audioEngine } from '../game/audioEngine';
import {
  X,
  Heart,
  Sparkles,
  Send,
  Gift,
  Shield,
  Flame,
  Repeat,
  History,
  UserCheck,
} from 'lucide-react';

interface DialogueModalProps {
  npc: NPCData;
  onClose: () => void;
  onUpdateNPC: (updatedNpc: NPCData) => void;
  onKarmaChange: (delta: number) => void;
  onToggleFollow?: (npcId: string, follow: boolean) => void;
  onGiveGift?: (itemId: string) => boolean;
  onBarterTrade?: () => boolean;
  onIntimateBoostVitals?: () => void;
}

interface DialogueOption {
  label: string;
  type: 'Compassion' | 'Pragmatic' | 'Intimate' | 'Ruthless' | 'Deception';
  text: string;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npc,
  onClose,
  onUpdateNPC,
  onKarmaChange,
  onToggleFollow,
  onGiveGift,
  onBarterTrade,
  onIntimateBoostVitals,
}) => {
  const [npcResponse, setNpcResponse] = useState<string>('');
  const [expression, setExpression] = useState<string>(npc.currentExpression);
  const [options, setOptions] = useState<DialogueOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [intimateMomentTriggered, setIntimateMomentTriggered] =
    useState<boolean>(false);
  const [showMemoryLog, setShowMemoryLog] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  useEffect(() => {
    fetchDialogue('Approached for conversation in the settlement.');
  }, [npc.id]);

  const computeRomanceStage = (
    affinity: number,
    intimacy: number
  ): RomanceStage => {
    if (affinity >= 85 && intimacy >= 75) return 'Devoted Soulmate';
    if (affinity >= 70 && intimacy >= 55) return 'Lover';
    if (affinity >= 55 && intimacy >= 35) return 'Intimate';
    if (affinity >= 40) return 'Confidant';
    if (affinity >= 25) return 'Trusted Ally';
    if (affinity >= 10) return 'Acquaintance';
    return 'Stranger';
  };

  const fetchDialogue = async (
    playerStatement: string,
    choiceType?: string
  ) => {
    setIsLoading(true);
    setIntimateMomentTriggered(false);

    try {
      const res = await fetch('/api/npc/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId: npc.id,
          npcName: npc.name,
          persona: npc.persona,
          affinity: npc.affinity,
          trust: npc.trust,
          moralAlignment: 'Empathetic',
          memory: npc.memoryLog,
          playerChoice: playerStatement,
          context: `Romance stage: ${npc.romanceStage}, Intimacy level: ${npc.intimacyLevel}/100, Following Player: ${!!npc.followingPlayer}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNpcResponse(data.dialogue);
        setExpression(data.expression || 'Warm');
        setOptions(data.options || []);

        const delta =
          typeof data.affinityDelta === 'number' ? data.affinityDelta : 3;
        const newAffinity = Math.max(-100, Math.min(100, npc.affinity + delta));
        const newTrust = Math.max(
          0,
          Math.min(100, npc.trust + (delta > 0 ? 4 : -2))
        );

        let newIntimacy = npc.intimacyLevel;
        if (choiceType === 'Intimate') {
          newIntimacy = Math.min(100, npc.intimacyLevel + 12);
          if (newAffinity >= 40) {
            setIntimateMomentTriggered(true);
            audioEngine.playIntimateMomentChord();
          }
        }

        if (choiceType === 'Compassion') onKarmaChange(5);
        if (choiceType === 'Ruthless') onKarmaChange(-8);

        const newStage = computeRomanceStage(newAffinity, newIntimacy);
        const updatedNpc: NPCData = {
          ...npc,
          affinity: newAffinity,
          trust: newTrust,
          intimacyLevel: newIntimacy,
          romanceStage: newStage,
          currentExpression: data.expression || npc.currentExpression,
          memoryLog: data.memoryNote
            ? [...npc.memoryLog.slice(-8), data.memoryNote]
            : npc.memoryLog,
          dialogueHistory: [
            ...npc.dialogueHistory,
            {
              speaker: 'player',
              text: playerStatement,
              timestamp: Date.now(),
            },
            { speaker: 'npc', text: data.dialogue, timestamp: Date.now() },
          ],
        };

        onUpdateNPC(updatedNpc);
      }
    } catch {
      setNpcResponse(
        'The wind howls across the ridge... stay close to the fire tonight.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Interactive Companion Action 1: Toggle Follow / Patrol Mode in 3D World
  const handleToggleCompanionFollow = () => {
    const nextFollow = !npc.followingPlayer;
    if (onToggleFollow) {
      onToggleFollow(npc.id, nextFollow);
    }
    const updated: NPCData = {
      ...npc,
      followingPlayer: nextFollow,
      memoryLog: [
        ...npc.memoryLog.slice(-8),
        nextFollow
          ? `Joined player on active frontier patrol.`
          : `Assigned to guard the Outcast Haven perimeter.`,
      ],
    };
    onUpdateNPC(updated);
    setActionBanner(
      nextFollow
        ? `${npc.name} is now physically walking with you in the 3D world!`
        : `${npc.name} will stand guard at their current position.`
    );
  };

  // Interactive Companion Action 2: Give Gift
  const handleGiveCompanionGift = () => {
    const usedInventoryGift = onGiveGift ? onGiveGift('mountain_sage') : true;
    audioEngine.playCraftSuccess();
    const newAffinity = Math.min(100, npc.affinity + 12);
    const newTrust = Math.min(100, npc.trust + 10);
    const newIntimacy = Math.min(100, npc.intimacyLevel + 8);
    const newStage = computeRomanceStage(newAffinity, newIntimacy);

    const giftLine =
      npc.id === 'elena'
        ? 'Fresh mountain sage and rations? Thank you... you always think of me even when the frost bites hardest.'
        : npc.id === 'drake'
        ? 'Quality field provisions. You know how to keep a commander battle-ready. Much appreciated.'
        : 'Now that is a gift worth smiling for. Keep spoiling me like this and I might never leave your side.';

    setNpcResponse(giftLine);
    setExpression('Affectionate');
    setActionBanner(
      usedInventoryGift
        ? `Gifted survival provisions to ${npc.name}! (+12 Affinity, +10 Trust)`
        : `Shared camp rations with ${npc.name}! (+12 Affinity, +10 Trust)`
    );

    onUpdateNPC({
      ...npc,
      affinity: newAffinity,
      trust: newTrust,
      intimacyLevel: newIntimacy,
      romanceStage: newStage,
      currentExpression: 'Affectionate',
      memoryLog: [
        ...npc.memoryLog.slice(-8),
        `Received a thoughtful gift of provisions (+12 Affinity).`,
      ],
    });
    onKarmaChange(4);
  };

  // Interactive Companion Action 3: Barter / Exchange Supplies
  const handleCompanionBarter = () => {
    if (onBarterTrade) {
      const ok = onBarterTrade();
      if (!ok) {
        setActionBanner(
          'Need at least 3 Timber Logs or Stone in your bag to barter for an Herbal Salve!'
        );
        return;
      }
    }
    audioEngine.playCraftSuccess();
    setActionBanner(
      `Exchanged salvage with ${npc.name} for +1 Herbal Salve & +1 Clean Water!`
    );
    setNpcResponse(
      'Fair trade. Take this medicinal salve and purified water—keep them in your pack for the outer sectors.'
    );
  };

  // Interactive Companion Action 4: Trigger Intimate Embrace / Heart-to-Heart
  const handleIntimateEmbrace = () => {
    audioEngine.playIntimateMomentChord();
    setIntimateMomentTriggered(true);
    if (onIntimateBoostVitals) onIntimateBoostVitals();

    const newAffinity = Math.min(100, npc.affinity + 14);
    const newIntimacy = Math.min(100, npc.intimacyLevel + 18);
    const newStage = computeRomanceStage(newAffinity, newIntimacy);

    const embraceText =
      npc.id === 'elena'
        ? 'Elena steps into your arms, resting her forehead against your shoulder as the hearth embers glow softly. "Out here, everything breaks... except what we have built together."'
        : npc.id === 'drake'
        ? 'Drake lowers his guard, his gauntleted hand resting warmly at your waist by the watchtower fire. "With you beside me, I finally have a future worth fighting for."'
        : 'Vesper pulls you close into the velvet shadows, her voice a warm whisper against your neck. "Let the storm rage outside... tonight belongs to us."';

    setNpcResponse(embraceText);
    setExpression('Passionate');
    setActionBanner(
      `Shared an intimate embrace with ${npc.name}! (+18 Intimacy, +14 Affinity, Full Morale)`
    );

    onUpdateNPC({
      ...npc,
      affinity: newAffinity,
      intimacyLevel: newIntimacy,
      romanceStage: newStage,
      currentExpression: 'Passionate',
      memoryLog: [
        ...npc.memoryLog.slice(-8),
        `Shared a deeply intimate embrace by the fire (${newStage}).`,
      ],
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isLoading) return;
    const text = customInput.trim();
    setCustomInput('');
    fetchDialogue(text, 'Intimate');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-neutral-900/95 text-neutral-100 rounded-2xl border border-neutral-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top NPC Identity & Relationship Bar */}
        <div className="p-3.5 sm:p-4 bg-neutral-950/90 border-b border-neutral-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold border-2 shrink-0"
              style={{
                borderColor: npc.color,
                backgroundColor: `${npc.color}22`,
              }}
            >
              {npc.name[0]}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {npc.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {npc.romanceStage}
                </span>
                {npc.followingPlayer && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Following You
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 truncate">
                {npc.title} · Expression:{' '}
                <span className="text-emerald-400 font-semibold">
                  {expression}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Relationship Meters */}
        <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800/80 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1 text-[11px]">
              <span>Affinity</span>
              <span className="font-mono text-emerald-400">
                {npc.affinity}/100
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, (npc.affinity + 100) / 2))}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1 text-[11px]">
              <span>Trust</span>
              <span className="font-mono text-sky-400">{npc.trust}/100</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${npc.trust}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1 text-[11px]">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" /> Intimacy
              </span>
              <span className="font-mono text-rose-400">
                {npc.intimacyLevel}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-purple-500 transition-all duration-300"
                style={{ width: `${npc.intimacyLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Interactive Companion Actions Bar */}
        <div className="px-4 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleToggleCompanionFollow}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              npc.followingPlayer
                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {npc.followingPlayer ? 'Following on Patrol' : 'Ask to Follow You'}
            </span>
          </button>

          <button
            onClick={handleGiveCompanionGift}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-amber-950/50 border border-neutral-700 hover:border-amber-500/50 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>Give Gift (+Affinity)</span>
          </button>

          <button
            onClick={handleCompanionBarter}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-sky-950/50 border border-neutral-700 hover:border-sky-500/50 text-[11px] font-bold text-sky-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Repeat className="w-3.5 h-3.5 text-sky-400" />
            <span>Barter Salvage</span>
          </button>

          <button
            onClick={handleIntimateEmbrace}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-[11px] font-bold text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Intimate Embrace</span>
          </button>

          <button
            onClick={() => setShowMemoryLog(!showMemoryLog)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] font-semibold text-neutral-300 flex items-center gap-1 ml-auto cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>Memories ({npc.memoryLog.length})</span>
          </button>
        </div>

        {/* Main Dialogue Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {actionBanner && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 font-semibold flex items-center justify-between">
              <span>{actionBanner}</span>
              <button
                onClick={() => setActionBanner(null)}
                className="text-neutral-400 hover:text-white ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {intimateMomentTriggered && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-neutral-900 border border-rose-500/40 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-xs text-rose-200">
                <span className="font-bold block text-rose-300">
                  Intimate Connection Deepened ({npc.romanceStage})
                </span>
                Your bond with {npc.name} grows closer amidst the harsh survival
                wilderness, restoring warmth and morale.
              </div>
            </div>
          )}

          {showMemoryLog && (
            <div className="p-3 rounded-xl bg-neutral-950 border border-purple-500/30 space-y-1.5">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-purple-300">
                Persistent NPC Memory Timeline
              </h4>
              <ul className="space-y-1 text-xs text-neutral-300 list-disc list-inside">
                {npc.memoryLog.map((mem, i) => (
                  <li key={i}>{mem}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>{npc.name} is considering your words...</span>
              </div>
            ) : (
              <p className="text-sm sm:text-base text-neutral-100 leading-relaxed italic">
                &ldquo;{npcResponse}&rdquo;
              </p>
            )}
          </div>

          {/* Dialogue Options */}
          {!isLoading && options.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                Choose Your Response
              </span>
              {options.map((opt, idx) => {
                const badgeColor =
                  opt.type === 'Intimate'
                    ? 'bg-rose-950 text-rose-300 border-rose-700/50'
                    : opt.type === 'Compassion'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                    : opt.type === 'Ruthless'
                    ? 'bg-red-950 text-red-300 border-red-700/50'
                    : 'bg-amber-950 text-amber-300 border-amber-700/50';

                return (
                  <button
                    key={idx}
                    onClick={() => fetchDialogue(opt.text, opt.type)}
                    className="w-full p-2.5 text-left rounded-xl bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/70 hover:border-amber-500/50 transition flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-amber-300">
                        {opt.label}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        &ldquo;{opt.text}&rdquo;
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}
                    >
                      {opt.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Freeform Custom Dialogue Input */}
          <form onSubmit={handleCustomSubmit} className="pt-1 flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={`Say something directly to ${npc.name}...`}
              className="flex-1 px-3.5 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isLoading || !customInput.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Speak</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
