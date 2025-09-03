import { NextApiResponse } from 'next';
import { loadUsers, createUser } from '../../../lib/auth';
import { withAdminOnly, ProtectedApiRequest } from '../../../lib/api-protection';

async function handler(req: ProtectedApiRequest, res: NextApiResponse) {

  try {
    if (req.method === 'GET') {
      // List all users (without passwords)
      const users = loadUsers().map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        sites: u.sites,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }));

      res.status(200).json({ users });

    } else if (req.method === 'POST') {
      // Create new user
      const { email, name, password, role, sites } = req.body;

      if (!email || !name || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!['admin', 'site-manager', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const newUser = await createUser({
        email,
        name,
        password,
        role,
        sites: sites || []
      });

      res.status(201).json({ 
        success: true, 
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          sites: newUser.sites
        }
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Users API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAdminOnly(handler);