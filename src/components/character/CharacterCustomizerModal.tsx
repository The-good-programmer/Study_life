import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Sparkles, 
  RotateCw, 
  User, 
  Shirt, 
  Glasses, 
  Check, 
  Shuffle, 
  Smile, 
  BookOpen, 
  Trophy, 
  Hand, 
  Palette
} from 'lucide-react';
import { 
  type CharacterCustomization, 
  type CharacterGender, 
  type BodyType, 
  type HairStyle, 
  type Eyewear, 
  type Headwear, 
  type OutfitTop, 
  type OutfitBottom, 
  type Shoes, 
  type CharacterPose,
  type FacialHair,
  SKIN_TONE_PALETTE,
  HAIR_COLOR_PALETTE,
  EYE_COLOR_PALETTE,
  TOP_COLOR_PALETTE,
  BOTTOM_COLOR_PALETTE,
  SHOE_COLOR_PALETTE,
  HAIR_STYLE_META,
  FACIAL_HAIR_META,
  OUTFIT_TOP_META,
  OUTFIT_BOTTOM_META,
  ACCESSORY_META,
} from '../../types/character';
import { characterService } from '../../services/characterService';
import { soundEngine } from '../../services/soundEngine';
import { CharacterCanvas3D } from './CharacterCanvas3D';

export interface CharacterCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (character: CharacterCustomization) => void;
}

type TabType = 'identity' | 'hair-face' | 'wardrobe' | 'accessories' | 'presets';

export const CharacterCustomizerModal: React.FC<CharacterCustomizerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('identity');
  const [character, setCharacter] = useState<CharacterCustomization>(() => characterService.getCharacter());
  const [cameraView, setCameraView] = useState<'full' | 'portrait' | 'torso'>('full');
  const [pose, setPose] = useState<CharacterPose>('idle');
  const [autoRotate, setAutoRotate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  if (!isOpen) return null;

  const updateField = <K extends keyof CharacterCustomization>(key: K, value: CharacterCustomization[K]) => {
    setCharacter((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setHasChanges(true);
    soundEngine.playTapPop();
  };

  const handleSave = () => {
    characterService.updateCustomization(character);
    setHasChanges(false);
    soundEngine.playSuccess();
    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#38bdf8', '#ec4899', '#fbbf24'],
      });
    } catch {}

    if (onSaved) onSaved(character);
    onClose();
  };

  const handleRandomize = () => {
    characterService.randomize();
    const updated = characterService.getCharacter();
    setCharacter(updated);
    setHasChanges(true);
    soundEngine.playTapPop();
  };

  const handlePreset = (preset: 'scholar' | 'tech' | 'athlete' | 'cozy' | 'creative') => {
    characterService.applyPreset(preset);
    const updated = characterService.getCharacter();
    setCharacter(updated);
    setHasChanges(true);
    soundEngine.playSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl h-[92vh] max-h-[850px] bg-[#0c1222] border border-indigo-500/30 rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
      >
        {/* Top Floating Controls on Mobile / Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-all cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* =========================================================================
            LEFT COLUMN: 3D Interactive Viewport
           ========================================================================= */}
        <div className="w-full md:w-5/12 lg:w-1/2 h-[42vh] md:h-full bg-gradient-to-b from-[#0a1128] via-[#0b1430] to-[#060a17] relative flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-800/80">
          {/* Header Title & Character Name */}
          <div className="w-full p-4 z-10 flex items-center justify-between pointer-events-none">
            <div className="pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-widest text-indigo-300 uppercase">3D Character Studio</span>
              </div>
              <h2 id="customizer-title" className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
                <span>{character.name || 'Student Avatar'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  Lv.{character.level}
                </span>
              </h2>
            </div>
          </div>

          {/* 3D Canvas Canvas */}
          <div className="absolute inset-0 w-full h-full">
            <CharacterCanvas3D
              customization={character}
              pose={pose}
              cameraView={cameraView}
              autoRotate={autoRotate}
              showPedestal={true}
              interactive={true}
            />
          </div>

          {/* Viewport Toolbar Controls */}
          <div className="w-full p-3 sm:p-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Camera View Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 pointer-events-auto shadow-lg">
              <button
                type="button"
                onClick={() => setCameraView('portrait')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  cameraView === 'portrait' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Face & Hair
              </button>
              <button
                type="button"
                onClick={() => setCameraView('torso')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  cameraView === 'torso' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Outfit
              </button>
              <button
                type="button"
                onClick={() => setCameraView('full')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  cameraView === 'full' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Body
              </button>
            </div>

            {/* Pose & Auto-spin */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                  autoRotate 
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60' 
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-700/60'
                }`}
                title="Toggle 360° Turntable"
              >
                <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin [animation-duration:6s]' : ''}`} />
              </button>

              <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-lg">
                <button
                  type="button"
                  onClick={() => setPose('idle')}
                  className={`p-1.5 rounded-lg transition-all ${pose === 'idle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Relaxed Pose"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPose('wave')}
                  className={`p-1.5 rounded-lg transition-all ${pose === 'wave' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Wave Pose"
                >
                  <Hand className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPose('study')}
                  className={`p-1.5 rounded-lg transition-all ${pose === 'study' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Study & Read Pose"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPose('cheer')}
                  className={`p-1.5 rounded-lg transition-all ${pose === 'cheer' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Victory Cheer Pose"
                >
                  <Trophy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Customizer Controls & Studio Dashboard
           ========================================================================= */}
        <div className="w-full md:w-7/12 lg:w-1/2 flex-1 flex flex-col h-[50vh] md:h-full bg-[#0a0f1d] overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 p-3 border-b border-slate-800/80 overflow-x-auto scrollbar-none bg-[#0d1426]">
            <button
              type="button"
              onClick={() => { setActiveTab('identity'); setCameraView('full'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'identity' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Identity</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('hair-face'); setCameraView('portrait'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'hair-face' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Hair &amp; Face</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('wardrobe'); setCameraView('torso'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'wardrobe' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Wardrobe</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('accessories'); setCameraView('portrait'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'accessories' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Glasses className="w-3.5 h-3.5" />
              <span>Gear</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('presets'); setCameraView('full'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'presets' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Styles</span>
            </button>
          </div>

          {/* Tab Content Panel (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-200">
            {/* ==================== TAB: IDENTITY ==================== */}
            {activeTab === 'identity' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={character.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Enter character name..."
                    maxLength={24}
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Sex &amp; Silhouette
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['female', 'male', 'nonbinary'] as CharacterGender[]).map((genderOption) => {
                      const isSelected = character.gender === genderOption;
                      const labels = {
                        female: { label: 'Female', desc: 'Slender, curved frame' },
                        male: { label: 'Male', desc: 'Broader athletic frame' },
                        nonbinary: { label: 'Non-Binary', desc: 'Balanced sleek frame' },
                      };
                      return (
                        <button
                          key={genderOption}
                          type="button"
                          onClick={() => updateField('gender', genderOption)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-sm font-bold flex items-center justify-between">
                            <span>{labels[genderOption].label}</span>
                            {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{labels[genderOption].desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Body Build
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['slender', 'average', 'athletic'] as BodyType[]).map((bt) => {
                      const isSelected = character.bodyType === bt;
                      return (
                        <button
                          key={bt}
                          type="button"
                          onClick={() => updateField('bodyType', bt)}
                          className={`py-2.5 px-3 rounded-xl border text-center font-bold text-xs capitalize transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {bt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Academic Title & Status Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/60 border border-indigo-500/20 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-indigo-300 font-bold tracking-wider">Academic Rank</span>
                    <h4 className="text-sm font-black text-white">{character.studyTitle}</h4>
                    <p className="text-xs text-slate-400">Level {character.level} • {character.coins} Coins in Wallet</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <Trophy className="w-5 h-5" />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: HAIR & FACE ==================== */}
            {activeTab === 'hair-face' && (
              <div className="space-y-6">
                {/* Hair Style */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Hairstyle
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(HAIR_STYLE_META) as HairStyle[]).map((hs) => {
                      const meta = HAIR_STYLE_META[hs];
                      const isSelected = character.hairStyle === hs;
                      return (
                        <button
                          key={hs}
                          type="button"
                          onClick={() => updateField('hairStyle', hs)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold line-clamp-1">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Facial Hair (for masculine / custom styling) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Beard &amp; Facial Hair
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">Stubble, goatee, beard</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(FACIAL_HAIR_META) as FacialHair[]).map((fh) => {
                      const meta = FACIAL_HAIR_META[fh];
                      const isSelected = (character.facialHair || 'none') === fh;
                      return (
                        <button
                          key={fh}
                          type="button"
                          onClick={() => updateField('facialHair', fh)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold line-clamp-1">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hair Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Hair Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {HAIR_COLOR_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('hairColor', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.hairColor.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-white shadow-lg shadow-indigo-500/30'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      >
                        {character.hairColor.toLowerCase() === pal.color.toLowerCase() && (
                          <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow-md" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skin Tone */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Skin Tone
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {SKIN_TONE_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('skinTone', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.skinTone.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-indigo-400 shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      >
                        {character.skinTone.toLowerCase() === pal.color.toLowerCase() && (
                          <Check className="w-4 h-4 text-slate-900 absolute inset-0 m-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Eye Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Eye Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {EYE_COLOR_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('eyeColor', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.eyeColor.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-white shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      >
                        {character.eyeColor.toLowerCase() === pal.color.toLowerCase() && (
                          <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: WARDROBE ==================== */}
            {activeTab === 'wardrobe' && (
              <div className="space-y-6">
                {/* Top Clothing */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Top / Outerwear
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(OUTFIT_TOP_META) as OutfitTop[]).map((top) => {
                      const meta = OUTFIT_TOP_META[top];
                      const isSelected = character.outfitTop === top;
                      return (
                        <button
                          key={top}
                          type="button"
                          onClick={() => updateField('outfitTop', top)}
                          className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-2xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top Color Palette */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Top Primary Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {TOP_COLOR_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('topColor', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.topColor.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-white shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Bottom Clothing */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Bottoms / Trousers
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(OUTFIT_BOTTOM_META) as OutfitBottom[]).map((bot) => {
                      const meta = OUTFIT_BOTTOM_META[bot];
                      const isSelected = character.outfitBottom === bot;
                      return (
                        <button
                          key={bot}
                          type="button"
                          onClick={() => updateField('outfitBottom', bot)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Bottoms Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {BOTTOM_COLOR_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('bottomColor', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.bottomColor.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-white shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Shoes */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Footwear
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['sneakers', 'boots', 'loafers', 'running'] as Shoes[]).map((shoe) => {
                      const isSelected = character.shoes === shoe;
                      const icons = { sneakers: '👟', boots: '🥾', loafers: '👞', running: '👟' };
                      return (
                        <button
                          key={shoe}
                          type="button"
                          onClick={() => updateField('shoes', shoe)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center capitalize text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl mb-1">{icons[shoe]}</span>
                          <span>{shoe}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shoes Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Shoe Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {SHOE_COLOR_PALETTE.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => updateField('shoesColor', pal.color)}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.shoesColor.toLowerCase() === pal.color.toLowerCase()
                            ? 'scale-110 border-indigo-400 shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: pal.color }}
                        title={pal.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: ACCESSORIES & GEAR ==================== */}
            {activeTab === 'accessories' && (
              <div className="space-y-6">
                {/* Eyewear */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Eyewear &amp; Glasses
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(ACCESSORY_META.eyewear) as Eyewear[]).map((eye) => {
                      const meta = ACCESSORY_META.eyewear[eye];
                      const isSelected = character.eyewear === eye;
                      return (
                        <button
                          key={eye}
                          type="button"
                          onClick={() => updateField('eyewear', eye)}
                          className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-2xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Headwear */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Headwear &amp; Focus Gear
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(ACCESSORY_META.headwear) as Headwear[]).map((hw) => {
                      const meta = ACCESSORY_META.headwear[hw];
                      const isSelected = character.headwear === hw;
                      return (
                        <button
                          key={hw}
                          type="button"
                          onClick={() => updateField('headwear', hw)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl mb-1">{meta.icon}</span>
                          <span className="text-xs font-bold">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gear Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Accessory Accent Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {['#4f46e5', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#0f172a', '#e2e8f0'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          updateField('headwearColor', color);
                          updateField('eyewearColor', color);
                        }}
                        className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer relative ${
                          character.headwearColor.toLowerCase() === color.toLowerCase()
                            ? 'scale-110 border-white shadow-lg'
                            : 'border-slate-700/80 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: PRESETS & STYLES ==================== */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curated Student Styles</span>
                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Randomize 🎲</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'scholar', title: 'Honor Roll Scholar', desc: 'Oxford button-down, chinos, side-part, wireframes', icon: '📖' },
                    { id: 'tech', title: 'Tech Polymath', desc: 'Cyber tee, headphones, spiky cyan locks, sneakers', icon: '💻' },
                    { id: 'athlete', title: 'Varsity Champion', desc: 'Varsity jacket, joggers, cap, high ponytail', icon: '🏆' },
                    { id: 'cozy', title: 'Late-Night Coder', desc: 'Oversized hoodie, pleated skirt, beanie, bob-cut', icon: '☕' },
                    { id: 'creative', title: 'Studio Researcher', desc: 'Warm cable sweater, curly afro, round glasses', icon: '🎨' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePreset(p.id as any)}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 text-left transition-all group flex items-start gap-3 cursor-pointer"
                    >
                      <span className="text-2xl p-2 rounded-xl bg-slate-800/80 shrink-0 group-hover:scale-110 transition-transform">{p.icon}</span>
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{p.title}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-[#0c1222] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRandomize}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 text-xs font-bold transition-all cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Randomize</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700/60 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{hasChanges ? 'Save Changes' : 'Save Character'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
