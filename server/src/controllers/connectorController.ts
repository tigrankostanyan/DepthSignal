import { Request, Response } from 'express';
import { ConnectorManager } from '../services/connectors/ConnectorManager.js';

//  connector controller
export class ConnectorController {
  constructor(private readonly connectorManager: ConnectorManager) {}

  // Health endpoint
  health = (_req: Request, res: Response): void => {
    res.json(this.connectorManager.getConnectorStatuses());
  };
}
