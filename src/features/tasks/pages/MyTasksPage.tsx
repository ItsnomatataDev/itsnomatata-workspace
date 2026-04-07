import TasksWorkspacePage from "./TasksWorkspacePage";

export default function MyTasksPage() {
  return (
    <TasksWorkspacePage
      defaultBoardMode="mine"
      pageTitle="My Tasks"
      pageDescription="Focused task board showing cards assigned to you."
      allowModeSwitch={false}
    />
  );
}
