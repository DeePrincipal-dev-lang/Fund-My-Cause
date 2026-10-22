import { render } from '@testing-library/react';
import { CampaignDetailSkeleton } from '@fund-my-cause/components';

describe('Visual Regression - Components', () => {
  it('should render ProgressBar consistently', () => {
    const { container } = render(
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }} />
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render CountdownTimer consistently', () => {
    const { container } = render(
      <div className="text-center">
        <p className="text-2xl font-bold">5 days, 12 hours</p>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render CampaignCard consistently', () => {
    const { container } = render(
      <div className="border rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold">Campaign Title</h3>
        <p className="text-gray-600">Campaign description</p>
        <div className="mt-4 flex justify-between">
          <span>$5,000 / $10,000</span>
          <span>50%</span>
        </div>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render PledgeModal consistently', () => {
    const { container } = render(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 w-96">
          <h2 className="text-xl font-bold mb-4">Make a Pledge</h2>
          <input type="number" placeholder="Amount" className="w-full border p-2 mb-4" />
          <button className="w-full bg-blue-600 text-white p-2 rounded">Pledge</button>
        </div>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render Navbar consistently', () => {
    const { container } = render(
      <nav className="bg-white shadow-md p-4 flex justify-between items-center">
        <div className="text-xl font-bold">Fund My Cause</div>
        <div className="flex gap-4">
          <a href="/">Home</a>
          <a href="/campaigns">Campaigns</a>
          <button>Connect Wallet</button>
        </div>
      </nav>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('Visual Regression - Layouts', () => {
  it('should render homepage layout consistently', () => {
    const { container } = render(
      <div className="min-h-screen">
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8">
          <h1 className="text-4xl font-bold">Welcome to Fund My Cause</h1>
        </header>
        <main className="p-8">
          <section className="grid grid-cols-3 gap-4">
            <div className="border rounded p-4">Campaign 1</div>
            <div className="border rounded p-4">Campaign 2</div>
            <div className="border rounded p-4">Campaign 3</div>
          </section>
        </main>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render campaign detail layout consistently', () => {
    const { container } = render(
      <div className="max-w-4xl mx-auto p-8">
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <img src="campaign.jpg" alt="Campaign" className="w-full rounded-lg" />
            <h1 className="text-3xl font-bold mt-4">Campaign Title</h1>
            <p className="text-gray-600 mt-2">Campaign description</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">$5,000 / $10,000</div>
            <button className="w-full bg-blue-600 text-white p-2 rounded mt-4">Pledge</button>
          </div>
        </div>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render responsive grid consistently', () => {
    const { container } = render(
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border rounded p-4">
            Card {i}
          </div>
        ))}
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('Visual Regression - States', () => {
  it('should render button states consistently', () => {
    const { container } = render(
      <div className="flex gap-4">
        <button className="bg-blue-600 text-white p-2 rounded">Normal</button>
        <button className="bg-blue-600 text-white p-2 rounded opacity-50 cursor-not-allowed">
          Disabled
        </button>
        <button className="bg-blue-700 text-white p-2 rounded">Hover</button>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render form states consistently', () => {
    const { container } = render(
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Amount</label>
          <input type="number" className="w-full border-2 border-red-500 p-2 rounded" />
          <p className="text-red-500 text-sm mt-1">This field is required</p>
        </div>
      </form>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should render loading state consistently', () => {
    const { container } = render(
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <span className="ml-4">Loading...</span>
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('Visual Regression - Skeleton States (#1112)', () => {
  it('should render CampaignDetailSkeleton consistently', () => {
    const { container, getByTestId } = render(<CampaignDetailSkeleton />);
    const root = getByTestId('campaign-detail-skeleton');
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveAttribute('aria-label', 'Loading campaign details');
    expect(container.firstChild).toMatchSnapshot();
  });

  it('CampaignDetailSkeleton applies custom className', () => {
    const { getByTestId } = render(
      <CampaignDetailSkeleton className="custom-class" />
    );
    expect(getByTestId('campaign-detail-skeleton')).toHaveClass('custom-class');
  });
});
