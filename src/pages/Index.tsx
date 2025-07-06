
import React, { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleSheetsService } from '@/services/googleSheetsService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from '@/components/SortableItem';

interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
}

const Index = () => {
  const [newItem, setNewItem] = useState('');
  const [localItems, setLocalItems] = useState<GroceryItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch grocery items from Google Sheets
  const { data: groceryItems = [], isLoading, error, refetch } = useQuery({
    queryKey: ['groceryItems'],
    queryFn: googleSheetsService.getGroceryItems,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Update local items when query data changes
  useEffect(() => {
    if (groceryItems && groceryItems.length > 0) {
      setLocalItems(groceryItems);
    }
  }, [groceryItems]);

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: (item: GroceryItem) => googleSheetsService.addGroceryItem(item),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item added successfully!",
      });
      setNewItem('');
      queryClient.invalidateQueries({ queryKey: ['groceryItems'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => googleSheetsService.deleteGroceryItem(itemId),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['groceryItems'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reorder items mutation
  const reorderItemsMutation = useMutation({
    mutationFn: (reorderedItems: GroceryItem[]) => googleSheetsService.reorderGroceryItems(reorderedItems),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Items reordered successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['groceryItems'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Revert local state on error
      setLocalItems(groceryItems);
    },
  });

  const handleAddItem = () => {
    if (newItem.trim()) {
      const item: GroceryItem = {
        id: `temp_${Date.now()}`,
        name: newItem.trim(),
        quantity: '',
        category: '',
      };
      addItemMutation.mutate(item);
    }
  };

  const handleDeleteItem = (item: GroceryItem) => {
    deleteItemMutation.mutate(item.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(localItems, oldIndex, newIndex);
      
      // Update local state immediately for responsive UI
      setLocalItems(newItems);
      
      // Send the reorder request to Google Sheets
      reorderItemsMutation.mutate(newItems);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing",
      description: "Syncing with Google Sheets...",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Grocery List</h1>
            <p className="text-sm text-gray-500">{localItems.length} items</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="p-2">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Add Item Section */}
        <Card className="p-4 mb-6 bg-white shadow-sm">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add new grocery item..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={addItemMutation.isPending}
            />
            <Button
              onClick={handleAddItem}
              disabled={!newItem.trim() || addItemMutation.isPending}
              className="px-4"
            >
              {addItemMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="p-4 mb-6 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 text-sm">
                  Unable to connect to Google Sheets. Please check your settings and ensure your Service Account is properly configured.
                </p>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="w-full mt-2 text-red-700 border-red-300"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </Card>
            ))}
          </div>
        )}

        {/* Grocery Items List */}
        {!isLoading && localItems.length === 0 ? (
          <Card className="p-8 text-center bg-white shadow-sm">
            <div className="text-gray-400 mb-2">
              <Plus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-500 mb-4">
              Add your first grocery item above to get started!
            </p>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {localItems.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onDelete={handleDeleteItem}
                    isDeleting={deleteItemMutation.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default Index;
