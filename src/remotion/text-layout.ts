export type TextLayout = {
  lines: string[];
  fontSize: number;
};

type LayoutTier = {
  maxCharacters: number;
  maxLines: number;
  fontSize: number;
  lineCharacterBudget: number;
};

const LAYOUT_TIERS: readonly LayoutTier[] = [
  {maxCharacters: 28, maxLines: 2, fontSize: 96, lineCharacterBudget: 14},
  {maxCharacters: 55, maxLines: 3, fontSize: 82, lineCharacterBudget: 19},
  {maxCharacters: 100, maxLines: 4, fontSize: 70, lineCharacterBudget: 25},
];

export const layoutSceneText = (text: string): TextLayout => {
  if (!text.trim()) {
    throw new Error('Scene text cannot be blank');
  }

  const tier = LAYOUT_TIERS.find(({maxCharacters}) => text.length <= maxCharacters);

  if (!tier) {
    throw new Error('Scene text must be 100 characters or fewer');
  }

  const lines: string[] = [];

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const previousLine = lines.at(-1);
    const candidate = previousLine ? `${previousLine} ${word}` : word;

    if (
      previousLine &&
      candidate.length > tier.lineCharacterBudget &&
      lines.length < tier.maxLines
    ) {
      lines.push(word);
    } else if (previousLine) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }

  return {lines, fontSize: tier.fontSize};
};
