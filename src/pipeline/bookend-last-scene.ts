export type BookendableScene = {
  localVideoPath: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
};

export function bookendLastScene<T extends BookendableScene>(scenes: T[]): T[] {
  const first = scenes[0];
  const last = scenes.at(-1);
  if (!first || !last || scenes.length < 2) return scenes;
  return [
    ...scenes.slice(0, -1),
    {
      ...last,
      localVideoPath: first.localVideoPath,
      sourcePageUrl: first.sourcePageUrl,
      creatorName: first.creatorName,
      creatorUrl: first.creatorUrl,
    },
  ];
}
