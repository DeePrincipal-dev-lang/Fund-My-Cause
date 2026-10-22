import type { Meta, StoryObj } from "@storybook/react";
import { Modal } from "./Modal";
import { useState } from "react";

const meta = {
  title: "Components/Modal",
  component: Modal,
  tags: ["autodocs"],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const ModalWrapper = (args: any) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Open Modal
      </button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export const Default: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: "Modal Title",
    children: (
      <div className="space-y-4">
        <p>This is the modal content area.</p>
        <p>You can place any content here.</p>
      </div>
    ),
  },
};

export const WithActions: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: "Confirm Action",
    children: <p>Are you sure you want to proceed with this action?</p>,
    footer: (
      <div className="flex gap-3 justify-end">
        <button className="px-4 py-2 border rounded">Cancel</button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">
          Confirm
        </button>
      </div>
    ),
  },
};

export const LargeContent: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: "Large Modal",
    children: (
      <div className="space-y-2">
        <p>This modal has substantial content.</p>
        <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
          Large Content Area
        </div>
      </div>
    ),
  },
};
