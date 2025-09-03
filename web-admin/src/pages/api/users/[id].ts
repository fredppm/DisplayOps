import { NextApiResponse } from 'next';
import { usersRepository } from '../../../lib/repositories/UsersRepository';
import { withAdminOnly, ProtectedApiRequest, getCurrentUser } from '../../../lib/api-protection';
import bcrypt from 'bcryptjs';

async function handler(req: ProtectedApiRequest, res: NextApiResponse) {
  const currentUser = getCurrentUser(req);

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    if (req.method === 'GET') {
      // Get specific user
      const user = await usersRepository.getById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sites: user.sites,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });

    } else if (req.method === 'PUT') {
      // Update user
      const existingUser = await usersRepository.getById(id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { email, name, role, sites, password } = req.body;

      // Prevent admin from changing their own role
      if (existingUser.id === currentUser.id && role !== existingUser.role) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }

      // Build update object
      const updates: any = {};
      if (email) updates.email = email;
      if (name) updates.name = name;
      if (role && ['admin', 'site-manager', 'viewer'].includes(role)) {
        updates.role = role;
      }
      if (sites !== undefined) updates.sites = sites;

      // Update password if provided
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 10);
      }

      const updatedUser = await usersRepository.update(id, updates);
      if (!updatedUser) {
        return res.status(500).json({ error: 'Failed to update user' });
      }

      res.status(200).json({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          sites: updatedUser.sites
        }
      });

    } else if (req.method === 'DELETE') {
      // Delete user
      const userToDelete = await usersRepository.getById(id);
      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent admin from deleting themselves
      if (userToDelete.id === currentUser.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const deleted = await usersRepository.delete(id);
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete user' });
      }

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