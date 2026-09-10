import { PaymentProof } from '../models/PaymentProof.js';

//  payment proof repository
export class PaymentProofRepository {
  // Find by id
  async findById(id: string): Promise<PaymentProof | null> {
    return PaymentProof.findByPk(id);
  }

  // Find by user
  async findByUser(userId: string, limit = 10): Promise<PaymentProof[]> {
    return PaymentProof.findAll({ where: { userId }, order: [['created_at', 'DESC']], limit });
  }

  // Find all
  async findAll(limit = 200): Promise<PaymentProof[]> {
    return PaymentProof.findAll({ order: [['created_at', 'DESC']], limit });
  }

  // Create
  async create(data: Omit<PaymentProof, 'createdAt'> & { createdAt?: number }): Promise<PaymentProof> {
    return PaymentProof.create({ ...data, createdAt: Date.now() } as any);
  }

  // Update status (optionally guarded by expectedStatus to avoid double-processing races)
  async updateStatus(id: string, status: string, reviewedBy?: string, expectedStatus?: string): Promise<PaymentProof | null> {
    const where: any = { id };
    if (expectedStatus) where.status = expectedStatus;
    const [affectedCount] = await PaymentProof.update(
      { status, reviewedBy: reviewedBy || null, reviewedAt: Date.now() },
      { where }
    );
    if (!affectedCount) return null;
    return this.findById(id);
  }
}
