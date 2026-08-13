export type VideoScene = {
  id: string;
  durationSeconds: number;
  text: string;
  searchQuery: string;
};

export type VideoPlan = {
  topic: string;
  title: string;
  scenes: VideoScene[];
};
