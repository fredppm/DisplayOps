import { NextApiResponse } from 'next';
import { loadUsers, saveUsers } from '../../../lib/auth';
import { withAdminOnly, ProtectedApiRequest, getCurrentUser } from '../../../lib/api-protection';
import bcrypt from 'bcryptjs';

async function handler(req: ProtectedApiRequest, res: NextApiResponse) {
  const currentUser = getCurrentUser(req);

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (req.method === 'GET') {
      // Get specific user
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = users[userIndex];
      res.status(200).json({
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          sites: userData.sites,
          createdAt: userData.createdAt,
          lastLogin: userData.lastLogin
        }
      });

    } else if (req.method === 'PUT') {
      // Update user
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { email, name, role, sites, password } = req.body;
      const existingUser = users[userIndex];

      // Prevent admin from changing their own role
      if (existingUser.id === currentUser.id && role !== existingUser.role) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }

      // Update user data
      if (email) existingUser.email = email;
      if (name) existingUser.name = name;
      if (role && ['admin', 'site-manager', 'viewer'].includes(role)) {
        existingUser.role = role;
      }
      if (sites !== undefined) existingUser.sites = sites;

      // Update password if provided
      if (password) {
        existingUser.password = await bcrypt.hash(password, 10);
      }

      users[userIndex] = existingUser;
      saveUsers(users);

      res.status(200).json({
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          sites: existingUser.sites
        }
      });

    } else if (req.method === 'DELETE') {
      // Delete user
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent admin from deleting themselves
      if (users[userIndex].id === currentUser.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      users.splice(userIndex, 1);
      saveUsers(users);

      res.status(200).json({ success: true, message: 'User deleted successfully' });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('User API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAdminOnly(handler);