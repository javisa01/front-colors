// import { useEffect, useMemo, useState } from "react";

// import type {
//     ChallengeManifestEntry,
//     ChallengeMetadata,
//     HSVColor,
// } from "@/types/challenge";
// import challengeCatalog from "../../generated/challenges.json";

// interface UseChallengeResult {
//   challenges: ChallengeManifestEntry[];
//   currentChallenge: ChallengeMetadata | null;
//   currentIndex: number;
//   selectedColor: string;
//   selectedHSV: HSVColor;
//   result: string;
//   isCorrect: boolean;
//   setSelectedColor: (color: string) => void;
//   setSelectedHSV: (hsv: HSVColor) => void;
//   nextChallenge: () => void;
//   previousChallenge: () => void;
//   resetSelection: () => void;
//   setResult: (value: string) => void;
//   setIsCorrect: (value: boolean) => void;
// }

// function loadChallengeMetadata(challengeId: string): ChallengeMetadata {
//   const metadata = (challengeCatalog as ChallengeMetadata[]).find(
//     (item) => item.id === challengeId,
//   );

//   if (!metadata) {
//     throw new Error(`Challenge not found: ${challengeId}`);
//   }

//   return {
//     ...metadata,
//     svgXml: metadata.svgXml ?? "",
//     editableColorIndex: metadata.editableColorIndex ?? 0,
//   };
// }

// export function useChallenge(): UseChallengeResult {
//   const [currentIndex, setCurrentIndex] = useState(0);
//   const [selectedColor, setSelectedColor] = useState("#878787");
//   const [selectedHSV, setSelectedHSV] = useState<HSVColor>({
//     h: 0,
//     s: 0,
//     v: 53,
//   });
//   const [result, setResult] = useState("");
//   const [isCorrect, setIsCorrect] = useState(false);

//   const challenges = useMemo(() => {
//     const catalogEntries = challengeCatalog as ChallengeMetadata[];
//     return catalogEntries
//       .filter((item) => item?.id && item?.colors?.length > 0)
//       .map((item) => ({
//         id: item.id,
//         colors: item.colors.length,
//       })) as ChallengeManifestEntry[];
//   }, []);

//   const currentChallenge = useMemo(() => {
//     const challenge = challenges[currentIndex];
//     if (!challenge) {
//       return null;
//     }

//     return loadChallengeMetadata(challenge.id);
//   }, [challenges, currentIndex]);

//   useEffect(() => {
//     if (!currentChallenge) {
//       return;
//     }

//     setSelectedColor("#878787");
//     setSelectedHSV({ h: 0, s: 0, v: 53 });
//     setResult("");
//     setIsCorrect(false);
//   }, [currentChallenge]);

//   const resetSelection = () => {
//     if (!currentChallenge) {
//       return;
//     }

//     setSelectedColor("#878787");
//     setSelectedHSV({ h: 0, s: 0, v: 53 });
//     setResult("");
//     setIsCorrect(false);
//   };

//   const nextChallenge = () => {
//     if (currentIndex < challenges.length - 1) {
//       setCurrentIndex((value) => value + 1);
//     }
//   };

//   const previousChallenge = () => {
//     if (currentIndex > 0) {
//       setCurrentIndex((value) => value - 1);
//     }
//   };

//   return {
//     challenges,
//     currentChallenge,
//     currentIndex,
//     selectedColor,
//     selectedHSV,
//     result,
//     isCorrect,
//     setSelectedColor,
//     setSelectedHSV,
//     nextChallenge,
//     previousChallenge,
//     resetSelection,
//     setResult,
//     setIsCorrect,
//   };
// }

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
    ChallengeManifestEntry,
    ChallengeMetadata,
    HSVColor,
} from "@/types/challenge";
import { hexToHSV, normalizeHex } from "@/utils/color";
import challengeCatalog from "../../generated/challenges.json";

interface UseChallengeResult {
  challenges: ChallengeManifestEntry[];
  currentChallenge: ChallengeMetadata | null;
  currentIndex: number;
  totalChallenges: number;
  selectedColor: string;
  selectedHSV: HSVColor;
  setSelectedColor: (color: string) => void;
  setSelectedHSV: (hsv: HSVColor) => void;
  nextChallenge: () => boolean;
  restartGame: () => void;
  resetSelection: () => void;
}

const INITIAL_COLOR = "#878787";
const INITIAL_HSV: HSVColor = hexToHSV(INITIAL_COLOR);

function loadChallengeMetadata(challengeId: string): ChallengeMetadata {
  const metadata = (challengeCatalog as ChallengeMetadata[]).find(
    (item) => item.id === challengeId,
  );

  if (!metadata) {
    throw new Error(`Challenge not found: ${challengeId}`);
  }

  return {
    ...metadata,
    svgXml: metadata.svgXml ?? "",
    editableColorIndex: metadata.editableColorIndex ?? 0,
  };
}

export function useChallenge(): UseChallengeResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedColor, setSelectedColorState] = useState(INITIAL_COLOR);
  const [selectedHSV, setSelectedHSVState] = useState<HSVColor>(INITIAL_HSV);

  const challenges = useMemo(() => {
    const catalogEntries = challengeCatalog as ChallengeMetadata[];

    return catalogEntries
      .filter(
        (item) =>
          item?.id && Array.isArray(item?.colors) && item.colors.length > 0,
      )
      .map((item) => ({
        id: item.id,
        colors: item.colors.length,
      })) as ChallengeManifestEntry[];
  }, []);

  const totalChallenges = challenges.length;

  const currentChallenge = useMemo(() => {
    const challenge = challenges[currentIndex];

    if (!challenge) {
      return null;
    }

    return loadChallengeMetadata(challenge.id);
  }, [challenges, currentIndex]);

  const resetSelection = useCallback((): void => {
    setSelectedColorState(INITIAL_COLOR);
    setSelectedHSVState(INITIAL_HSV);
  }, []);

  useEffect(() => {
    if (!currentChallenge) {
      return;
    }

    resetSelection();
  }, [currentChallenge, resetSelection]);

  const setSelectedColor = useCallback((color: string): void => {
    setSelectedColorState(normalizeHex(color));
  }, []);

  const setSelectedHSV = useCallback((hsv: HSVColor): void => {
    setSelectedHSVState(hsv);
  }, []);

  const nextChallenge = useCallback((): boolean => {
    if (currentIndex >= challenges.length - 1) {
      return false;
    }

    setCurrentIndex((value) => value + 1);
    return true;
  }, [currentIndex, challenges.length]);

  const restartGame = useCallback((): void => {
    setCurrentIndex(0);
    resetSelection();
  }, [resetSelection]);

  return {
    challenges,
    currentChallenge,
    currentIndex,
    totalChallenges,
    selectedColor,
    selectedHSV,
    setSelectedColor,
    setSelectedHSV,
    nextChallenge,
    restartGame,
    resetSelection,
  };
}
