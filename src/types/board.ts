

import type { ClientItem } from "../features/clients/services/clientService";
import type {
    TaskBoardColumn,
    TaskItem,
    TaskPriority,
    TaskStatus,
} from "../lib/supabase/queries/tasks";
import type { TaskAssigneeItem } from "../lib/supabase/queries/tasks";

export interface Board extends ClientItem {

    taskCount?: number;
    timeTrackedSeconds?: number;
    memberCount?: number;
    recentActivityAt?: string;
}


export interface List extends TaskBoardColumn {

    boardId?: string; 
    taskCount?: number;
}

export interface Card extends TaskItem {

    assignees?: TaskAssigneeItem[]; 
    comments?: CardComment[];
    commentsCount?: number;
    checklists?: CardChecklist[];
    checklistProgress?: { completed: number; total: number };
    attachments?: CardAttachment[];
    labels?: CardLabel[];
    isRunningTimer?: boolean;
    invitedCount?: number;
    creatorAvatar?: string; 
}


export interface CardComment {
    id: string;
    cardId: string;
    userId: string;
    userFullName?: string;
    userEmail?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface CardChecklist {
    id: string;
    cardId: string;
    title: string;
    items: CardChecklistItem[];
}

export interface CardChecklistItem {
    id: string;
    checklistId: string;
    title: string;
    completed: boolean;
    completedAt?: string;
}

export interface CardAttachment {
    id: string;
    cardId: string;
    type: "file" | "link";
    name: string;
    url: string;
    uploadedBy?: string;
    uploadedAt: string;
}

export interface CardLabel {
    id: string;
    name: string;
    color: string; 
    cardId?: string;
}

export interface BoardView {
    board: Board;
    lists: List[];
    cards: Record<string, Card[]>; 
}


export interface BoardStats {
    totalCards: number;
    cardsInProgress: number;
    cardsDone: number;
    totalTimeTracked: number; // seconds
    activeMembersCount: number;
    recentActivities: BoardActivity[];
}

export interface BoardActivity {
    id: string;
    type:
        | "card_created"
        | "card_moved"
        | "card_completed"
        | "member_added"
        | "comment_added"
        | "time_tracked";
    userId: string;
    userName?: string;
    cardId?: string;
    cardTitle?: string;
    description: string;
    timestamp: string;
}

export interface DragPayload {
    cardId: string;
    fromListId: string;
    fromPosition: number;
}
