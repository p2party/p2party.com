import { Button } from "../button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../dialog";
import { Field, Label } from "../fieldset";
import { Input } from "../input";

import type { Dispatch, SetStateAction } from "react";

export interface SettingsDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export const SettingsDialog = ({ isOpen, setIsOpen }: SettingsDialogProps) => {
  return (
    <Dialog open={isOpen} onClose={setIsOpen}>
      <DialogTitle>Refund payment</DialogTitle>
      <DialogDescription>
        The refund will be reflected in the customer’s bank account 2 to 3
        business days after processing.
      </DialogDescription>
      <DialogBody>
        <Field>
          <Label>Amount</Label>
          <Input name='amount' placeholder='$0.00' />
        </Field>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button onClick={() => setIsOpen(false)}>Refund</Button>
      </DialogActions>
    </Dialog>
  );
};
