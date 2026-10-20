import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="space-y-2">
        <h3 className="font-semibold">Card Title</h3>
        <p className="text-sm text-gray-600">
          This is a card component for displaying grouped content.
        </p>
      </div>
    ),
  },
};

export const WithPadding: Story = {
  args: {
    className: "p-6",
    children: (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Featured Content</h2>
        <p>Cards help organize information into digestible sections.</p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    className: "hover:shadow-lg transition-shadow cursor-pointer",
    children: (
      <div className="space-y-3">
        <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-600 rounded" />
        <h3 className="font-semibold">Interactive Card</h3>
        <p className="text-sm">Click me for more details</p>
      </div>
    ),
  },
};
