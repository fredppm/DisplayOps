import React from 'react';
import Link from 'next/link';
import { Card, CardContent, StatusBadge, Button } from '@/components/common';
import { Server, Network, Clock, Settings } from 'lucide-react';

interface Controller {
  id: string;
  siteId: string;
  name: string;
  localNetwork: string;
  mdnsService: string;
  webAdminUrl: string;
  status: 'online' | 'offline' | 'error';
  lastSync: string;
  version: string;
}

interface ControllerCardProps {
  controller: Controller;
  onEdit?: (controller: Controller) => void;
  onDelete?: (controller: Controller) => void;
}

const ControllerCard: React.FC<ControllerCardProps> = ({ 
  controller, 
  onEdit, 
  onDelete 
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {controller.name}
            </h3>
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <Server className="w-4 h-4 mr-1" />
              {controller.siteId}
            </div>
            <StatusBadge status={controller.status} />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(controller)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Network:</span>
            <div className="flex items-center text-gray-900">
              <Network className="w-4 h-4 mr-1" />
              {controller.localNetwork}
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">mDNS Service:</span>
            <span className="text-gray-900 font-mono text-xs">{controller.mdnsService}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Version:</span>
            <span className="text-gray-900">{controller.version}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Last Sync:</span>
            <div className="flex items-center text-gray-900">
              <Clock className="w-4 h-4 mr-1" />
              {new Date(controller.lastSync).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Link
            href={`/controllers/${controller.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details
          </Link>
          
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit?.(controller)}
            >
              Edit
            </Button>
            
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(controller)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ControllerCard;