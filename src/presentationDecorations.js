import stonePillarUrl from './assets/stone-pillar-transparent.png';
import completeStoneFrame1Url from './assets/presentation/complete-stone-frame-1.png';
import completeLightFrame2Url from './assets/presentation/complete-light-frame-2.png';
import completeGabionFrame3Url from './assets/presentation/complete-gabion-frame-3.png';
import completeLightFrame4Url from './assets/presentation/complete-light-frame-4.png';
import stoneMidUrl from './assets/presentation/stone-mid.png';
import blackMid3Url from './assets/presentation/black-mid-3.png';
import blackPillar3Url from './assets/presentation/black-pillar-3.png';
import blackMid2Url from './assets/presentation/black-mid-2.png';
import blackPillar2Url from './assets/presentation/black-pillar-2.png';

export const builtInPresentationDecorations = [
  {
    id: 'builtin-stone-pillar',
    name: 'Stone pillar',
    imageUrl: stonePillarUrl,
    naturalWidth: 1086,
    naturalHeight: 1448,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-complete-stone-frame-1',
    name: 'Complete stone frame 1',
    imageUrl: completeStoneFrame1Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-complete-light-frame-2',
    name: 'Complete light frame 2',
    imageUrl: completeLightFrame2Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-complete-gabion-frame-3',
    name: 'Complete gabion frame 3',
    imageUrl: completeGabionFrame3Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-complete-light-frame-4',
    name: 'Complete light frame 4',
    imageUrl: completeLightFrame4Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-stone-mid',
    name: 'Stone mid',
    imageUrl: stoneMidUrl,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-black-mid-3',
    name: 'Black mid 3',
    imageUrl: blackMid3Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-black-pillar-3',
    name: 'Black pillar 3',
    imageUrl: blackPillar3Url,
    naturalWidth: 1086,
    naturalHeight: 1448,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-black-mid-2',
    name: 'Black mid 2',
    imageUrl: blackMid2Url,
    naturalWidth: 1448,
    naturalHeight: 1086,
    builtIn: true,
    projectAsset: true
  },
  {
    id: 'project-black-pillar-2',
    name: 'Black pillar 2',
    imageUrl: blackPillar2Url,
    naturalWidth: 1086,
    naturalHeight: 1448,
    builtIn: true,
    projectAsset: true
  }
];

export const fallbackPresentationDecorationUrl = stonePillarUrl;

export const legacyPresentationDecorationAliases = {
  'complete 1': 'project-complete-stone-frame-1',
  'complete 2': 'project-complete-light-frame-2',
  'complete 3': 'project-complete-gabion-frame-3',
  'complete 4': 'project-complete-light-frame-4',
  'stone mid': 'project-stone-mid',
  mid3: 'project-black-mid-3',
  pillar3: 'project-black-pillar-3',
  'mid 2': 'project-black-mid-2',
  'pillar 2': 'project-black-pillar-2'
};
