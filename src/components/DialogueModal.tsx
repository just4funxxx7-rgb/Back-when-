import React, { useState } from 'react';
import { NPCData } from '../types/game';
import { audioEngine } from '../game/audioEngine';
import { Heart, Send, Sparkles, X, Shield, MessageSquare } from 'lucide-react';

interface DialogueModalProps {
  npc: NPCData;
  onClose: () => void;
  onUpdateNPC: (updated: NPCData) => void;
  onKarmaChange: (delta: number) => void;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npc,
  onClose,
  onUpdateNPC,
  onKarmaChange,
}) => {
  const [currentDialogue, setCurrentDialogue] = useState<string>(
    npc.affinity > 40
      ? `It's good to see you in one piece. The wild is unforgiving, but sitting here by the fire with you makes the darkness feel a little further away.`
      : `What brings you to my post, survivor? Speak your business quickly; night is coming.`
  );
  const [expression, setExpression] = useState(npc.currentExpression);
  const [freeformInput, setFreeformInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<
    { label: string; type: string; text: string }[]
  >([
    {
      label: 'Offer heartfelt comfort & share rations',
      type: 'Compassion',
      text: 'You look exhausted, Elena. Rest here by the hearth; I’ll keep watch tonight.',
    },
    {
      label: 'Discuss survival defenses & perimeter',
      type: 'Pragmatic',
      text: 'Have scouts spotted any raider activity across the northern ridge?',
    },
    {
      label: 'Share an intimate personal reflection',
      type: 'Intimate',
      text: 'Before the Collapse, did you ever imagine we’d find solace in a world like this together?',
    },
  ]);

  const handleSelectOption = async (option: { label: string; type: string; text: string }) => {
    setIsLoading(true);
    audioEngine.playFootstep('wood');

    let affinityDelta = 4;
    let intimacyDelta = 2;
    let karmaDelta = 0;

    if (option.type === 'Compassion') {
      karmaDelta = 5;
      affinityDelta = 6;
      intimacyDelta = 4;
    } else if (option.type === 'Intimate') {
      intimacyDelta = 8;
      affinityDelta = 7;
      audioEngine.playIntimateMomentChord();
    } else if (option.type === 'Ruthless') {
      karmaDelta = -8;
      affinityDelta = -4;
    }

    try {
      const response = await fetch('/api/npc/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId: npc.id,
          npcName: npc.name,
          persona: npc.persona,
          affinity: npc.affinity + affinityDelta,
          trust: npc.trust + 5,
          memory: npc.memoryLog,
          playerChoice: option.text,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentDialogue(data.dialogue);
        setExpression(data.expression || 'Warm');
        if (data.options && data.options.length > 0) {
          setOptions(data.options);
        }

        const newAffinity = Math.max(-100, Math.min(100, npc.affinity + (data.affinityDelta || affinityDelta)));
        const newIntimacy = Math.min(100, npc.intimacyLevel + intimacyDelta);

        let newRomance = npc.romanceStage;
        if (newIntimacy >= 75) newRomance = 'Lover';
        else if (newIntimacy >= 55) newRomance = 'Intimate';
        else if (newIntimacy >= 40) newRomance = 'Confidant';
        else if (newAffinity >= 30) newRomance = 'Trusted Ally';

        const updatedNPC: NPCData = {
          ...npc,
          affinity: newAffinity,
          intimacyLevel: newIntimacy,
          romanceStage: newRomance,
          currentExpression: data.expression || expression,
          memoryLog: [...npc.memoryLog, data.memoryNote || `Discussed ${option.type.toLowerCase()} concerns.`],
        };

        onUpdateNPC(updatedNPC);
        onKarmaChange(karmaDelta);
      }
    } catch {
      // Fallback local update
      setCurrentDialogue(`Thank you for speaking honestly with me. In a world full of ghosts, your loyalty matters.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFreeform = async () => {
    if (!freeformInput.trim()) return;
    const msg = freeformInput.trim();
    setFreeformInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/npc/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId: npc.id,
          npcName: npc.name,
          persona: npc.persona,
          affinity: npc.affinity,
          trust: npc.trust,
          memory: npc.memoryLog,
          playerChoice: msg,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentDialogue(data.dialogue);
        setExpression(data.expression || 'Warm');
        if (data.options && data.options.length > 0) {
          setOptions(data.options);
        }

        const updatedNPC: NPCData = {
          ...npc,
          affinity: Math.max(-100, Math.min(100, npc.affinity + (data.affinityDelta || 3))),
          memoryLog: [...npc.memoryLog, data.memoryNote || `Player said: "${msg.slice(0, 40)}..."`],
        };
        onUpdateNPC(updatedNPC);
        audioEngine.playIntimateMomentChord();
      }
    } catch {
      setCurrentDialogue("I hear your words. We will hold our ground together.");
    } finally {
      setIsLoading(false);
    }
  };

  const expressionColors: Record<string, string> = {
    Warm: 'border-emerald-500 text-emerald-400',
    Affectionate: 'border-rose-500 text-rose-400',
    Passionate: 'border-purple-500 text-purple-400',
    Seductive: 'border-fuchsia-500 text-fuchsia-400',
    Stern: 'border-amber-500 text-amber-400',
    Guarded: 'border-blue-500 text-blue-400',
    Despairing: 'border-neutral-500 text-neutral-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 select-none animate-fade-in pointer-events-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with NPC Dossier */}
        <div className="flex items-center justify-between p-4 bg-neutral-950/90 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                expressionColors[expression] || 'border-neutral-500 text-white'
              } bg-neutral-800`}
            >
              {npc.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-100">{npc.name}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-semibold">
                  {npc.romanceStage}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    expressionColors[expression] || 'text-neutral-400 border-neutral-700'
                  }`}
                >
                  Expression: {expression}
                </span>
              </div>
              <p className="text-xs text-neutral-400">{npc.title} · {npc.role}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meters Bar: Affinity & Intimacy */}
        <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-neutral-950/50 border-b border-neutral-800/80 text-xs font-mono">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>Trust & Affinity:</span>
              <span className="text-emerald-400 font-bold">{npc.affinity}/100</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, npc.affinity))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                Intimate Bond:
              </span>
              <span className="text-purple-400 font-bold">{npc.intimacyLevel}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, npc.intimacyLevel))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dialogue Scroll Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {/* NPC Speech Bubble */}
          <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800/90 relative">
            <span className="text-xs font-mono font-bold text-amber-400 block mb-1">
              {npc.name}:
            </span>
            <p className="text-sm text-neutral-200 leading-relaxed font-sans">
              "{currentDialogue}"
            </p>
          </div>

          {/* Moral Branching Choices */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 block">
              Choose your response / moral stance:
            </span>

            {options.map((opt, idx) => (
              <button
                key={idx}
                disabled={isLoading}
                onClick={() => handleSelectOption(opt)}
                className="w-full p-3 bg-neutral-950/60 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-500/60 rounded-xl text-left transition group flex items-start gap-3"
              >
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold shrink-0 mt-0.5 ${
                    opt.type === 'Compassion'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : opt.type === 'Intimate'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : opt.type === 'Ruthless'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  [{opt.type}]
                </span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 transition">
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-neutral-400 italic mt-0.5">
                    "{opt.text}"
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Free-form AI input box (Powered by Gemini) */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2">
          <input
            type="text"
            placeholder={`Say something directly to ${npc.name}...`}
            value={freeformInput}
            onChange={(e) => setFreeformInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendFreeform()}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-sans"
          />
          <button
            onClick={handleSendFreeform}
            disabled={isLoading || !freeformInput.trim()}
            className="p-2 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 text-white rounded-xl transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
