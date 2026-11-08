export type MainItem = {
  id: string;
  title: string;
  completed: boolean;
};

export type MainItemFilter = "all" | "active" | "completed";
