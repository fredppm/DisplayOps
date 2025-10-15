import React from 'react';
import Link from 'next/link';
import { Card, CardContent, StatusBadge, Button } from '@/components/common';
import { MapPin, Monitor, Settings } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  location: string;
  timezone: string;
  hosts: string[];
  status: 'online' | 'offline' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface SiteCardProps {
  site: Site;
  onEdit?: (site: Site) => void;
  onDelete?: (site: Site) => void;
}

const SiteCard: React.FC<SiteCardProps> = ({ site, onEdit, onDelete }) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {site.name}
            </h3>
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <MapPin className="w-4 h-4 mr-1" />
              {site.location}
            </div>
            <StatusBadge status={site.status} />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(site)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Hosts:</span>
            <div className="flex items-center text-gray-900">
              <Monitor className="w-4 h-4 mr-1" />
              {site.hosts.length}
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Timezone:</span>
            <span className="text-gray-900">{site.timezone}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Link
            href={`/sites/${site.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details
          </Link>
          
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit?.(site)}
            >
              Edit
            </Button>
            
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(site)}
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

export default SiteCard;