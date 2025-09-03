import React from 'react';
import { NextPage } from 'next';
import Link from 'next/link';

const NewControllerPage: NextPage = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/controllers" className="text-blue-500 hover:underline">
          ← Back to Controllers
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Create New Controller</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Controller Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., Rio 1st Floor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Select a site</option>
              <option value="rio">Office Rio</option>
              <option value="nyc">Office NYC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Local Network
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., 192.168.1.0/24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              mDNS Service
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              defaultValue="_displayops._tcp.local"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create Controller
            </button>
            <Link
              href="/controllers"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewControllerPage;