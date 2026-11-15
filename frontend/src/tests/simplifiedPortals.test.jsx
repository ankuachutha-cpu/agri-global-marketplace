import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockApi, RATES } from './utils.jsx';
import AddCrop from '../pages/farmer/AddCrop.jsx';
import FarmerDashboard from '../pages/farmer/FarmerDashboard.jsx';
import FarmerInventory from '../pages/farmer/FarmerInventory.jsx';
import FarmerCollections from '../pages/farmer/FarmerCollections.jsx';
import FarmerPayments from '../pages/farmer/FarmerPayments.jsx';
import CreateRequirement from '../pages/buyer/CreateRequirement.jsx';
import BuyerRequirements from '../pages/buyer/BuyerRequirements.jsx';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';

vi.mock('../services/api.js', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return {
    default: api,
    TOKEN_KEY: 'agri_token',
    imgUrl: (p) => p,
    errMsg: (e) => e?.response?.data?.message || e?.message || 'Something went wrong'
  };
});
import api from '../services/api.js';

// Mock Leaflet MapView
vi.mock('../components/MapView.jsx', () => ({
  default: () => <div data-testid="mock-map">Map View</div>
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockApi({ '/currency/rates': RATES });
});

describe('Automated Procurement & Aggregation 3-Portal Test Suite', () => {
  it('1. AddCrop strictly offers only Ragi, Rice, Jowar and handles GPS coordinates', async () => {
    mockApi({
      '/currency/rates': RATES,
      'POST /crops': { crop: { _id: 'crop1', name: 'Ragi', quantity: 5000 } }
    });

    renderApp(<AddCrop />, { loggedInAs: 'farmer' });

    // Verify only the 3 allowed crops are present
    expect(screen.getByRole('button', { name: /ragi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jowar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tomato/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /wheat/i })).toBeNull();

    // Verify Live GPS button exists
    expect(screen.getByRole('button', { name: /use current gps location/i })).toBeInTheDocument();

    // Fill form and submit
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 5000/i), '5000');
    await userEvent.click(screen.getByRole('button', { name: /save crop produce/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/crops', expect.any(FormData), expect.any(Object));
    });
  });

  it('2. FarmerDashboard renders live MongoDB KPIs, crop breakdowns, and zero accept/reject buttons', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/farmer/dashboard': {
        farmerName: 'Ramesh Gowda',
        metrics: {
          totalUploadedKg: 35000,
          availableKg: 20000,
          allocatedKg: 15000,
          collectedKg: 0,
          totalEarningsInr: 190000,
          pendingPaymentsInr: 570000,
          completedPaymentsCount: 1,
          activeCollectionsCount: 1
        },
        cropBreakdown: {
          Ragi: { totalKg: 35000, availableKg: 20000, allocatedKg: 15000, collectedKg: 0 },
          Rice: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
          Jowar: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 }
        },
        activeCollections: [
          {
            requirementId: 'REQ-2611-1001',
            cropName: 'Ragi',
            allocatedQuantityKg: 15000,
            vehicleType: 'Large Container 40T',
            registrationNumber: 'KA-09-AG-7788',
            driverName: 'Ramesh Kumar',
            driverPhone: '+91 98765 43210',
            vehicleStatus: 'vehicle_assigned'
          }
        ]
      }
    });

    renderApp(<FarmerDashboard />, { loggedInAs: 'farmer' });

    expect(await screen.findByText('Farmer Procurement Hub')).toBeInTheDocument();
    expect(screen.getAllByText(/35,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15,000/).length).toBeGreaterThan(0);

    // Verify ZERO accept/reject buttons exist on dashboard
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('3. FarmerInventory renders listed crops with breakdown and zero accept/reject buttons', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/farmer/inventory': {
        inventory: [
          {
            _id: 'c1',
            name: 'Ragi',
            grade: 'Grade A',
            totalQuantityKg: 35000,
            availableQuantityKg: 20000,
            allocatedQuantityKg: 15000,
            collectedQuantityKg: 0,
            pricePerKg: 38,
            expectedPricePerQuintal: 3800,
            farmAddress: 'Dudda Village, Mandya',
            status: 'allocated'
          }
        ]
      }
    });

    renderApp(<FarmerInventory />, { loggedInAs: 'farmer' });

    expect(await screen.findByText('My Produce & Inventory')).toBeInTheDocument();
    expect(screen.getByText('Dudda Village, Mandya')).toBeInTheDocument();
    expect(screen.getByText('35,000 kg')).toBeInTheDocument();

    // Verify NO accept/reject buttons
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('4. FarmerCollections renders vehicle specifications and progressive timeline', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/farmer/collections': {
        collections: [
          {
            requirementId: 'REQ-DEMO-01',
            allocationId: 'ALC-01',
            cropName: 'Ragi',
            grade: 'Grade A',
            allocatedQuantityKg: 15000,
            procurementPricePerKg: 38,
            farmerGrossPayable: 570000,
            collectionStatus: 'vehicle_assigned',
            vehicle: {
              vehicleType: 'Large Container 40T',
              registrationNumber: 'KA-09-AG-7788',
              driverName: 'Ramesh Kumar',
              driverPhone: '+91 98765 43210',
              currentStatus: 'vehicle_assigned'
            },
            deliveryDestination: 'Bengaluru Distribution Hub'
          }
        ]
      }
    });

    renderApp(<FarmerCollections />, { loggedInAs: 'farmer' });

    expect(await screen.findByText('Vehicle Collection Tracking')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('KA-09-AG-7788')).toBeInTheDocument();
    expect(screen.getByText('Large Container 40T')).toBeInTheDocument();
  });

  it('5. FarmerPayments renders settled earnings and ledger', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/farmer/payments': {
        payments: [
          {
            _id: 'p1',
            paymentId: 'PAY-DEMO-88',
            cropName: 'Ragi',
            collectedQuantityKg: 5000,
            agreedPricePerKg: 38,
            grossAmountInr: 190000,
            finalPayableAmountInr: 190000,
            status: 'completed',
            transactionRef: 'TXN-UPI-884129',
            paymentDate: new Date().toISOString()
          }
        ]
      }
    });

    renderApp(<FarmerPayments />, { loggedInAs: 'farmer' });

    expect(await screen.findByText('Payment & Settlement History')).toBeInTheDocument();
    expect(screen.getAllByText('PAY-DEMO-88').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1,?90,?000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/TXN-UPI-884129/)).toBeInTheDocument();
  });

  it('6. CreateRequirement submits bulk requirement and triggers automated multi-farm matching', async () => {
    mockApi({
      '/currency/rates': RATES,
      'POST /requirements': {
        requirement: {
          _id: 'req_new',
          requirementId: 'REQ-2611-9999',
          cropName: 'Ragi',
          requiredQuantityKg: 50000,
          allocatedQuantityKg: 50000,
          status: 'allocated',
          allocations: [
            { farmerName: 'Ramesh Gowda', allocatedQuantityKg: 25000, procurementPricePerKg: 38 },
            { farmerName: 'Suresh Patel', allocatedQuantityKg: 25000, procurementPricePerKg: 37 }
          ]
        }
      }
    });

    renderApp(<CreateRequirement />, { loggedInAs: 'buyer' });

    expect(screen.getByRole('heading', { name: /post bulk crop purchase requirement/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /submit requirement/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/requirements', expect.objectContaining({
        cropName: 'Ragi',
        requiredQuantityKg: 50000
      }));
    });

    expect(await screen.findByText(/requirement successfully created & matched/i)).toBeInTheDocument();
    expect(screen.getByText(/REQ-2611-9999/)).toBeInTheDocument();
  });

  it('7. BuyerRequirements displays allocation progress and confirm delivery button', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/buyer/requirements': {
        requirements: [
          {
            _id: 'req1',
            requirementId: 'REQ-2611-1001',
            cropName: 'Ragi',
            requiredGrade: 'Grade A',
            requiredQuantityKg: 30000,
            allocatedQuantityKg: 30000,
            collectedQuantityKg: 0,
            status: 'allocated',
            deliveryDestination: 'Bengaluru Distribution Hub',
            allocations: [
              { farmerName: 'Farmer 1', allocatedQuantityKg: 15000, procurementPricePerKg: 38, collectionStatus: 'vehicle_assigned' },
              { farmerName: 'Farmer 2', allocatedQuantityKg: 15000, procurementPricePerKg: 37, collectionStatus: 'vehicle_assigned' }
            ]
          }
        ]
      }
    });

    renderApp(<BuyerRequirements />, { loggedInAs: 'buyer' });

    expect(await screen.findByText('My Procurement Requirements')).toBeInTheDocument();
    expect(screen.getByText('REQ-2611-1001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm delivery receipt/i })).toBeInTheDocument();
  });

  it('8. AdminDashboard renders live MongoDB metrics and crop breakdowns', async () => {
    mockApi({
      '/currency/rates': RATES,
      '/admin-portal/dashboard': {
        metrics: {
          totalFarmers: 3,
          totalBuyers: 2,
          totalInventoryKg: 156000,
          totalAvailableKg: 126000,
          totalAllocatedKg: 30000,
          totalCollectedKg: 0,
          activeRequirementsCount: 1,
          completedRequirementsCount: 0,
          vehiclesDeployedCount: 1,
          lotsCount: 1,
          totalPaymentVolumeInr: 1125000,
          pendingPaymentsInr: 1125000,
          completedPaymentsInr: 0
        },
        cropBreakdown: {
          Ragi: { totalKg: 80000, availableKg: 50000, allocatedKg: 30000, collectedKg: 0 },
          Rice: { totalKg: 28000, availableKg: 28000, allocatedKg: 0, collectedKg: 0 },
          Jowar: { totalKg: 48000, availableKg: 48000, allocatedKg: 0, collectedKg: 0 }
        },
        recentRequirements: [],
        recentPayments: []
      }
    });

    renderApp(<AdminDashboard />, { loggedInAs: 'admin' });

    expect(await screen.findByText(/admin control hub/i)).toBeInTheDocument();
    expect(screen.getAllByText(/156\.0/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80\.0/).length).toBeGreaterThan(0);
  });
});
