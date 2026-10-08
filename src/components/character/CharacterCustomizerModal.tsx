import React, { useState } from 'react';
import { BookOpen, Check, Glasses, Hand, Palette, RotateCw, Shirt, Shuffle, Smile, Sparkles, Trophy, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  type BodyType,
  type CharacterCustomization,
  type CharacterGender,
  type CharacterPose,
  type Eyewear,
  type FacialHair,
  type HairStyle,
  type Headwear,
  type OutfitBottom,
  type OutfitTop,
  type Shoes,
  ACCESSORY_META,
  BOTTOM_COLOR_PALETTE,
  EYE_COLOR_PALETTE,
  FACIAL_HAIR_META,
  HAIR_COLOR_PALETTE,
  HAIR_STYLE_META,
  OUTFIT_BOTTOM_META,
  OUTFIT_TOP_META,
  SHOE_COLOR_PALETTE,
  SKIN_TONE_PALETTE,
  TOP_COLOR_PALETTE,
} from '../../types/character';
import { characterService, type StylePresetId } from '../../services/characterService';
import { soundEngine } from '../../services/soundEngine';
import { useStudyLevel } from '../../hooks/useStudyLevel';
import { cn } from '../../utils/cn';
import { Dialog, DialogPanel } from '../common/Dialog';
import { Button, IconButton } from '../ui/primitives';
import { CharacterCanvas3D } from './CharacterCanvas3D';

export interface CharacterCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (character: CharacterCustomization) => void;
}

type TabId = 'you' | 'hair-face' | 'clothes' | 'accessories' | 'styles';
type CameraView = 'full' | 'portrait' | 'torso';

const TABS: { id: TabId; label: string; icon: LucideIcon; camera: CameraView }[] = [
  { id: 'you', label: 'You', icon: User, camera: 'full' },
  { id: 'hair-face', label: 'Hair and face', icon: Palette, camera: 'portrait' },
  { id: 'clothes', label: 'Clothes', icon: Shirt, camera: 'torso' },
  { id: 'accessories', label: 'Accessories', icon: Glasses, camera: 'portrait' },
  { id: 'styles', label: 'Styles', icon: Sparkles, camera: 'full' },
];

const FIGURES: { id: CharacterGender; label: string }[] = [
  { id: 'female', label: 'Feminine' },
  { id: 'male', label: 'Masculine' },
  { id: 'nonbinary', label: 'Androgynous' },
];

const BUILDS: { id: BodyType; label: string }[] = [
  { id: 'slender', label: 'Slender' },
  { id: 'average', label: 'Average' },
  { id: 'athletic', label: 'Athletic' },
];

const SHOES: { id: Shoes; label: string; icon: string }[] = [
  { id: 'sneakers', label: 'Sneakers', icon: '👟' },
  { id: 'boots', label: 'Boots', icon: '🥾' },
  { id: 'loafers', label: 'Loafers', icon: '👞' },
  { id: 'running', label: 'Running shoes', icon: '👟' },
];

const ACCENT_COLORS = ['#4f46e5', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#0f172a', '#e2e8f0'];

const STYLE_PRESETS: { id: StylePresetId; title: string; desc: string; icon: string }[] = [
  { id: 'scholar', title: 'Honor roll', desc: 'Button-down, chinos, side part, wire frames', icon: '📖' },
  { id: 'tech', title: 'Tech', desc: 'Tee, headphones, spiky cyan hair, sneakers', icon: '💻' },
  { id: 'athlete', title: 'Varsity', desc: 'Varsity jacket, joggers, cap, ponytail', icon: '🏆' },
  { id: 'cozy', title: 'Late night', desc: 'Hoodie, pleated skirt, beanie, bob', icon: '☕' },
  { id: 'creative', title: 'Studio', desc: 'Cable sweater, curls, round glasses, boots', icon: '🎨' },
];

const POSES: { id: CharacterPose; label: string; icon: LucideIcon }[] = [
  { id: 'idle', label: 'Relaxed', icon: Smile },
  { id: 'wave', label: 'Wave', icon: Hand },
  { id: 'study', label: 'Reading', icon: BookOpen },
  { id: 'cheer', label: 'Cheer', icon: Trophy },
];

const sameColor = (a: string | undefined, b: string) => (a ?? '').toLowerCase() === b.toLowerCase();

/** The avatar editor: a live 3D preview beside the options. Nothing is kept until Save. */
export const CharacterCustomizerModal: React.FC<CharacterCustomizerModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState<TabId>('you');
  const [character, setCharacter] = useState<CharacterCustomization>(() => characterService.getCharacter());
  const studyLevel = useStudyLevel();
  const [cameraView, setCameraView] = useState<CameraView>('full');
  const [pose, setPose] = useState<CharacterPose>('idle');
  const [autoRotate, setAutoRotate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Start from the saved avatar each time the editor opens (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setCharacter(characterService.getCharacter());
      setHasChanges(false);
      setActiveTab('you');
      setCameraView('full');
    }
  }

  const update = (partial: Partial<CharacterCustomization>) => {
    setCharacter(prev => ({ ...prev, ...partial }));
    setHasChanges(true);
    soundEngine.playTapPop();
  };

  const save = () => {
    characterService.updateCustomization(character);
    soundEngine.playSuccess();
    onSaved?.(character);
    onClose();
  };

  const openTab = (tab: (typeof TABS)[number]) => {
    setActiveTab(tab.id);
    setCameraView(tab.camera);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="avatar-title" className="max-w-5xl">
      <DialogPanel className="h-[92dvh] max-h-[860px] md:flex-row">
        {/* Preview */}
        <div className="relative flex h-[38dvh] shrink-0 flex-col justify-between overflow-hidden border-b border-line bg-canvas md:h-auto md:w-1/2 md:border-b-0 md:border-r">
          <div className="absolute inset-0">
            <CharacterCanvas3D
              customization={character}
              pose={pose}
              cameraView={cameraView}
              autoRotate={autoRotate}
              showPedestal
              interactive
              className="min-h-0!"
            />
          </div>

          <div className="pointer-events-none relative flex items-start justify-between gap-3 p-4">
            <div className="pointer-events-auto min-w-0">
              <p className="text-xs text-ink-subtle">Your avatar · level {studyLevel.level}</p>
              <h2 id="avatar-title" className="truncate text-[17px] font-semibold text-ink">
                {character.name || 'Your avatar'}
              </h2>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="pointer-events-auto -mr-1 -mt-1 shrink-0 md:hidden" />
          </div>

          <div className="pointer-events-none relative flex flex-wrap items-center justify-between gap-2 p-3">
            <div role="radiogroup" aria-label="Camera" className="pointer-events-auto flex rounded-xl border border-line-strong bg-surface-solid/90 p-1 backdrop-blur">
              {(
                [
                  { id: 'portrait', label: 'Face' },
                  { id: 'torso', label: 'Outfit' },
                  { id: 'full', label: 'Full' },
                ] as const
              ).map(view => (
                <button
                  key={view.id}
                  type="button"
                  role="radio"
                  aria-checked={cameraView === view.id}
                  onClick={() => setCameraView(view.id)}
                  className={cn(
                    'h-7 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer',
                    cameraView === view.id ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-line-strong bg-surface-solid/90 p-1 backdrop-blur">
              <IconButton
                icon={RotateCw}
                label="Turntable"
                active={autoRotate}
                aria-pressed={autoRotate}
                onClick={() => setAutoRotate(v => !v)}
                className="h-8 w-8"
              />
              <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
              {POSES.map(p => (
                <IconButton
                  key={p.id}
                  icon={p.icon}
                  label={`${p.label} pose`}
                  active={pose === p.id}
                  aria-pressed={pose === p.id}
                  onClick={() => setPose(p.id)}
                  className="h-8 w-8"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex min-h-0 flex-1 flex-col md:w-1/2">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line pl-3 pr-2">
            <div role="tablist" aria-label="Avatar options" className="flex gap-4 overflow-x-auto px-1 pt-3 no-scrollbar">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => openTab(tab)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                    activeTab === tab.id ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="hidden shrink-0 md:inline-flex" />
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            {activeTab === 'you' && (
              <>
                <div>
                  <label htmlFor="avatar-name" className="text-[13px] font-medium text-ink">
                    Name
                  </label>
                  <input
                    id="avatar-name"
                    type="text"
                    value={character.name}
                    onChange={e => update({ name: e.target.value })}
                    placeholder="What should we call you?"
                    maxLength={24}
                    className="mt-1.5 h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                  />
                </div>
                <OptionGroup label="Figure">
                  <div className="grid grid-cols-3 gap-2">
                    {FIGURES.map(f => (
                      <OptionTile key={f.id} label={f.label} selected={character.gender === f.id} onClick={() => update({ gender: f.id })} />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Build">
                  <div className="grid grid-cols-3 gap-2">
                    {BUILDS.map(b => (
                      <OptionTile key={b.id} label={b.label} selected={character.bodyType === b.id} onClick={() => update({ bodyType: b.id })} />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Skin tone">
                  <Swatches palette={SKIN_TONE_PALETTE} value={character.skinTone} onPick={skinTone => update({ skinTone })} />
                </OptionGroup>
                <p className="rounded-2xl bg-surface-hover px-4 py-3 text-[13px] text-ink-muted">
                  <span className="font-medium text-ink">{studyLevel.title}</span> · level {studyLevel.level}. Your level rises as you study.
                </p>
              </>
            )}

            {activeTab === 'hair-face' && (
              <>
                <OptionGroup label="Hairstyle">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(HAIR_STYLE_META) as HairStyle[]).map(hs => (
                      <OptionTile
                        key={hs}
                        icon={HAIR_STYLE_META[hs].icon}
                        label={HAIR_STYLE_META[hs].name}
                        selected={character.hairStyle === hs}
                        onClick={() => update({ hairStyle: hs })}
                      />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Hair colour">
                  <Swatches palette={HAIR_COLOR_PALETTE} value={character.hairColor} onPick={hairColor => update({ hairColor })} />
                </OptionGroup>
                <OptionGroup label="Facial hair">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(FACIAL_HAIR_META) as FacialHair[]).map(fh => (
                      <OptionTile
                        key={fh}
                        icon={FACIAL_HAIR_META[fh].icon}
                        label={FACIAL_HAIR_META[fh].name}
                        selected={(character.facialHair || 'none') === fh}
                        onClick={() => update({ facialHair: fh })}
                      />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Eye colour">
                  <Swatches palette={EYE_COLOR_PALETTE} value={character.eyeColor} onPick={eyeColor => update({ eyeColor })} />
                </OptionGroup>
              </>
            )}

            {activeTab === 'clothes' && (
              <>
                <OptionGroup label="Top">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(Object.keys(OUTFIT_TOP_META) as OutfitTop[]).map(top => (
                      <OptionTile
                        key={top}
                        icon={OUTFIT_TOP_META[top].icon}
                        label={OUTFIT_TOP_META[top].name}
                        selected={character.outfitTop === top}
                        onClick={() => update({ outfitTop: top })}
                      />
                    ))}
                  </div>
                  <Swatches palette={TOP_COLOR_PALETTE} value={character.topColor} onPick={topColor => update({ topColor })} className="mt-3" />
                </OptionGroup>
                <OptionGroup label="Bottoms">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(Object.keys(OUTFIT_BOTTOM_META) as OutfitBottom[]).map(bottom => (
                      <OptionTile
                        key={bottom}
                        icon={OUTFIT_BOTTOM_META[bottom].icon}
                        label={OUTFIT_BOTTOM_META[bottom].name}
                        selected={character.outfitBottom === bottom}
                        onClick={() => update({ outfitBottom: bottom })}
                      />
                    ))}
                  </div>
                  <Swatches palette={BOTTOM_COLOR_PALETTE} value={character.bottomColor} onPick={bottomColor => update({ bottomColor })} className="mt-3" />
                </OptionGroup>
                <OptionGroup label="Shoes">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SHOES.map(s => (
                      <OptionTile key={s.id} icon={s.icon} label={s.label} selected={character.shoes === s.id} onClick={() => update({ shoes: s.id })} />
                    ))}
                  </div>
                  <Swatches palette={SHOE_COLOR_PALETTE} value={character.shoesColor} onPick={shoesColor => update({ shoesColor })} className="mt-3" />
                </OptionGroup>
              </>
            )}

            {activeTab === 'accessories' && (
              <>
                <OptionGroup label="Glasses">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(Object.keys(ACCESSORY_META.eyewear) as Eyewear[]).map(eye => (
                      <OptionTile
                        key={eye}
                        icon={ACCESSORY_META.eyewear[eye].icon}
                        label={ACCESSORY_META.eyewear[eye].name}
                        selected={character.eyewear === eye}
                        onClick={() => update({ eyewear: eye })}
                      />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Headwear">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(ACCESSORY_META.headwear) as Headwear[]).map(hw => (
                      <OptionTile
                        key={hw}
                        icon={ACCESSORY_META.headwear[hw].icon}
                        label={ACCESSORY_META.headwear[hw].name}
                        selected={character.headwear === hw}
                        onClick={() => update({ headwear: hw })}
                      />
                    ))}
                  </div>
                </OptionGroup>
                <OptionGroup label="Accent colour">
                  <Swatches
                    palette={ACCENT_COLORS.map(color => ({ id: color, label: color, color }))}
                    value={character.headwearColor}
                    onPick={color => update({ headwearColor: color, eyewearColor: color })}
                  />
                </OptionGroup>
              </>
            )}

            {activeTab === 'styles' && (
              <>
                <p className="text-[13px] text-ink-muted">A style changes clothes, hair and accessories. Your figure and skin tone stay as they are.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STYLE_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => update(characterService.presetLook(p.id))}
                      className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface-hover cursor-pointer"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-xl" aria-hidden="true">
                        {p.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-ink">{p.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-subtle">{p.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-canvas-raised px-5 py-3.5 sm:px-6">
            <Button variant="ghost" icon={Shuffle} onClick={() => update(characterService.randomLook())}>
              Surprise me
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" icon={Check} onClick={save} disabled={!hasChanges}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  );
};

const OptionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <section>
    <h3 className="mb-2 text-[13px] font-medium text-ink">{label}</h3>
    {children}
  </section>
);

const OptionTile: React.FC<{ label: string; icon?: string; selected: boolean; onClick: () => void }> = ({ label, icon, selected, onClick }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      'flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors cursor-pointer',
      selected ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
    )}
  >
    {icon && (
      <span className="text-xl leading-none" aria-hidden="true">
        {icon}
      </span>
    )}
    <span className="line-clamp-1 text-xs font-medium">{label}</span>
  </button>
);

const Swatches: React.FC<{
  palette: { id: string; label: string; color: string }[];
  value: string | undefined;
  onPick: (color: string) => void;
  className?: string;
}> = ({ palette, value, onPick, className }) => (
  <div className={cn('flex flex-wrap gap-2', className)}>
    {palette.map(p => {
      const selected = sameColor(value, p.color);
      return (
        <button
          key={p.id}
          type="button"
          aria-pressed={selected}
          aria-label={p.label}
          title={p.label}
          onClick={() => onPick(p.color)}
          className={cn(
            'relative h-8 w-8 rounded-full border border-black/15 transition-transform cursor-pointer',
            selected ? 'ring-2 ring-brand ring-offset-2 ring-offset-[var(--surface-solid)]' : 'hover:scale-105',
          )}
          style={{ backgroundColor: p.color }}
        />
      );
    })}
  </div>
);
