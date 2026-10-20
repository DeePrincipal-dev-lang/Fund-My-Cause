import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 100, step: 5 },
    },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    progress: 0,
  },
};

export const QuarterFull: Story = {
  args: {
    progress: 25,
  },
};

export const HalfFull: Story = {
  args: {
    progress: 50,
  },
};

export const ThreeQuarterFull: Story = {
  args: {
    progress: 75,
  },
};

export const Complete: Story = {
  args: {
    progress: 100,
  },
};

export const WithLabel: Story = {
  args: {
    progress: 65,
  },
  render: (args) => (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm">
        <span>Campaign Progress</span>
        <span className="font-semibold">{args.progress}%</span>
      </div>
      <ProgressBar {...args} />
    </div>
  ),
};
