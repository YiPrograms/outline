import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import styled from "styled-components";
import type { ComponentProps } from "../types";

// Types for our Kanban board
interface Task {
  id: string;
  title: string;
  documentId?: string;
}

interface Column {
  id: string;
  title: string;
  taskIds: string[];
}

interface BoardData {
  columns: Column[];
  tasks: Record<string, Task>;
}

// Styled components
const BoardContainer = React.memo(styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  background: ${(props) => props.theme.backgroundSecondary || "#f4f7f9"};
  border-radius: 8px;
  min-height: 400px;
  user-select: none;
`);

const ColumnContainer = styled.div<{ isDragging?: boolean }>`
  background: ${(props) => props.theme.background || "#ffffff"};
  border-radius: 6px;
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  opacity: ${(props) => (props.isDragging ? 0.5 : 1)};
`;

const ColumnHeader = styled.div`
  padding: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${(props) => props.theme.divider || "#eee"};
`;

const TaskList = styled.div`
  padding: 8px;
  flex-grow: 1;
  min-height: 100px;
`;

const TaskCard = styled.div<{ isDragging?: boolean }>`
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: grab;
  opacity: ${(props) => (props.isDragging ? 0.5 : 1)};
  position: relative;

  &:hover {
    border-color: #bbb;
    .task-actions {
      display: flex;
    }
  }
`;

const TaskActions = styled.div`
  display: none;
  position: absolute;
  top: 4px;
  right: 4px;
  gap: 4px;
`;

const ActionButton = styled.button`
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 10px;
  cursor: pointer;
  &:hover {
    background: #e0e0e0;
  }
`;

const AddButton = styled.button`
  background: transparent;
  border: none;
  color: #666;
  padding: 8px;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
`;

const DocLink = styled.a`
  display: block;
  font-size: 11px;
  color: ${(props) => props.theme.link || "#0366d6"};
  margin-top: 4px;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

// Sortable Task Item
const SortableTask = ({
  task,
  onDelete,
  onRename,
  onLink,
  onClickLink,
}: {
  task: Task;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onLink: (id: string) => void;
  onClickLink: (href: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "Task", task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TaskCard
      ref={setNodeRef}
      style={style}
      isDragging={isDragging}
      {...attributes}
      {...listeners}
    >
      <div onClick={(e) => { e.stopPropagation(); onRename(task.id); }}>
        {task.title}
      </div>
      {task.documentId ? (
        <DocLink
          href={`/doc/${task.documentId}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClickLink(`/doc/${task.documentId}`);
          }}
        >
          📄 Linked Doc
        </DocLink>
      ) : (
        <DocLink
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLink(task.id);
          }}
          style={{ color: "#999" }}
        >
          + Create Doc
        </DocLink>
      )}
      <TaskActions className="task-actions">
        <ActionButton onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>✕</ActionButton>
      </TaskActions>
    </TaskCard>
  );
};

// Sortable Column
const SortableColumn = ({ column, tasks, children, onRenameColumn }: { column: Column, tasks: Task[], children: React.ReactNode, onRenameColumn: (id: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "Column", column } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <ColumnContainer ref={setNodeRef} style={style} isDragging={isDragging}>
      <ColumnHeader {...attributes} {...listeners} onDoubleClick={() => onRenameColumn(column.id)}>
        {column.title}
        <span style={{ color: "#999", fontSize: "12px" }}>{tasks.length}</span>
      </ColumnHeader>
      <TaskList>
        <SortableContext items={column.taskIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </TaskList>
    </ColumnContainer>
  );
};

export const KanbanBoard = ({ node, view, getPos, isEditable }: ComponentProps) => {
  const board = node.attrs.board as BoardData;
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState<"Column" | "Task" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateBoard = (newBoard: BoardData) => {
    if (!isEditable) return;
    const { tr } = view.state;
    view.dispatch(
      tr.setNodeMarkup(getPos(), undefined, {
        ...node.attrs,
        board: newBoard,
      })
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveType(event.active.data.current?.type);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === "Task";
    const isOverATask = over.data.current?.type === "Task";

    if (!isActiveATask) return;

    if (isActiveATask && isOverATask) {
      const activeIndex = board.columns.findIndex(col => col.taskIds.includes(activeId));
      const overIndex = board.columns.findIndex(col => col.taskIds.includes(overId));

      if (activeIndex !== overIndex) {
        const newBoard = { ...board };
        const activeColumn = newBoard.columns[activeIndex];
        const overColumn = newBoard.columns[overIndex];

        activeColumn.taskIds = activeColumn.taskIds.filter(id => id !== activeId);
        overColumn.taskIds.splice(overColumn.taskIds.indexOf(overId), 0, activeId);

        updateBoard(newBoard);
      }
    }

    const isOverAColumn = over.data.current?.type === "Column";
    if (isActiveATask && isOverAColumn) {
      const activeIndex = board.columns.findIndex(col => col.taskIds.includes(activeId));
      const overIndex = board.columns.findIndex(col => col.id === overId);

      if (activeIndex !== overIndex) {
        const newBoard = { ...board };
        const activeColumn = newBoard.columns[activeIndex];
        const overColumn = newBoard.columns[overIndex];

        activeColumn.taskIds = activeColumn.taskIds.filter(id => id !== activeId);
        overColumn.taskIds.push(activeId);

        updateBoard(newBoard);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveAColumn = active.data.current?.type === "Column";
    if (isActiveAColumn) {
      const oldIndex = board.columns.findIndex(col => col.id === activeId);
      const newIndex = board.columns.findIndex(col => col.id === overId);

      const newBoard = {
        ...board,
        columns: arrayMove(board.columns, oldIndex, newIndex),
      };
      updateBoard(newBoard);
    } else {
      const activeIndex = board.columns.findIndex(col => col.taskIds.includes(activeId));
      const overIndex = board.columns.findIndex(col => col.taskIds.includes(overId));

      if (activeIndex === overIndex && activeIndex !== -1) {
        const newBoard = { ...board };
        const column = newBoard.columns[activeIndex];
        const oldTaskIndex = column.taskIds.indexOf(activeId);
        const newTaskIndex = column.taskIds.indexOf(overId);

        column.taskIds = arrayMove(column.taskIds, oldTaskIndex, newTaskIndex);
        updateBoard(newBoard);
      }
    }
  };

  const addTask = (columnId: string) => {
    const title = window.prompt("Task Title");
    if (!title) return;

    const taskId = `task-${Date.now()}`;
    const newBoard = { ...board };
    newBoard.tasks[taskId] = { id: taskId, title };
    const colIndex = newBoard.columns.findIndex(c => c.id === columnId);
    newBoard.columns[colIndex].taskIds.push(taskId);

    updateBoard(newBoard);
  };

  const deleteTask = (taskId: string) => {
    if (!window.confirm("Delete task?")) return;
    const newBoard = { ...board };
    delete newBoard.tasks[taskId];
    newBoard.columns = newBoard.columns.map(col => ({
      ...col,
      taskIds: col.taskIds.filter(id => id !== taskId)
    }));
    updateBoard(newBoard);
  };

  const renameTask = (taskId: string) => {
    const task = board.tasks[taskId];
    const title = window.prompt("Rename task", task.title);
    if (!title) return;
    const newBoard = { ...board };
    newBoard.tasks[taskId] = { ...task, title };
    updateBoard(newBoard);
  };

  const renameColumn = (columnId: string) => {
    const column = board.columns.find(c => c.id === columnId);
    if (!column) return;
    const title = window.prompt("Rename column", column.title);
    if (!title) return;
    const newBoard = { ...board };
    const colIndex = newBoard.columns.findIndex(c => c.id === columnId);
    newBoard.columns[colIndex] = { ...column, title };
    updateBoard(newBoard);
  };

  const linkToDocument = async (taskId: string) => {
    const task = board.tasks[taskId];
    const editorProps = (view.props as any);
    
    if (editorProps.onCreateLink) {
      try {
        const documentId = await editorProps.onCreateLink({
          title: task.title,
        });
        if (documentId) {
          const newBoard = { ...board };
          newBoard.tasks[taskId] = { ...task, documentId };
          updateBoard(newBoard);
        }
      } catch (error) {
        console.error("Failed to create link", error);
      }
    } else {
      const docId = window.prompt("Enter Document ID");
      if (docId) {
        const newBoard = { ...board };
        newBoard.tasks[taskId] = { ...task, documentId: docId };
        updateBoard(newBoard);
      }
    }
  };

  const onClickLink = (href: string) => {
    const editorProps = (view.props as any);
    if (editorProps.onClickLink) {
      editorProps.onClickLink(href);
    } else {
      window.open(href, "_blank");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <BoardContainer>
        <SortableContext
          items={board.columns.map(c => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {board.columns.map((column) => (
            <SortableColumn
              key={column.id}
              column={column}
              tasks={column.taskIds.map(id => board.tasks[id]).filter(Boolean)}
              onRenameColumn={renameColumn}
            >
              {column.taskIds.map((taskId) => (
                <SortableTask
                  key={taskId}
                  task={board.tasks[taskId]}
                  onDelete={deleteTask}
                  onRename={renameTask}
                  onLink={linkToDocument}
                  onClickLink={onClickLink}
                />
              ))}
              {isEditable && (
                <AddButton onClick={() => addTask(column.id)}>+ Add Task</AddButton>
              )}
            </SortableColumn>
          ))}
        </SortableContext>
      </BoardContainer>

      <DragOverlay>
        {activeId ? (
          activeType === "Task" ? (
            <TaskCard isDraggingOverlay>{board.tasks[activeId]?.title}</TaskCard>
          ) : (
            <ColumnContainer isDraggingOverlay>
              <ColumnHeader>{board.columns.find(c => c.id === activeId)?.title}</ColumnHeader>
            </ColumnContainer>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
