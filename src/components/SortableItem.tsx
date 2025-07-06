import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, RefreshCw } from 'lucide-react';

interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
}

interface SortableItemProps {
  item: GroceryItem;
  onDelete: (item: GroceryItem) => void;
  isDeleting: boolean;
}

export const SortableItem: React.FC<SortableItemProps> = ({ item, onDelete, isDeleting }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 z-50 shadow-lg scale-105' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{item.name}</h3>
            {item.quantity && (
              <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
            )}
            {item.category && (
              <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {item.category}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering drag when clicking delete
            onDelete(item);
          }}
          disabled={isDeleting}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 cursor-pointer"
          title="Delete item"
        >
          {isDeleting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Card>
  );
};
