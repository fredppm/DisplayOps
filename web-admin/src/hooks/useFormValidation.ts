import { useState, useCallback } from 'react';
import { z } from 'zod';

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

interface UseFormValidationReturn<T> {
  values: Partial<T>;
  errors: Record<string, string>;
  isValid: boolean;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  validateField: (field: keyof T) => boolean;
  validateForm: () => ValidationResult<T>;
  clearErrors: () => void;
  reset: () => void;
}

export function useFormValidation<T>(
  schema: z.ZodSchema<T>,
  initialValues: Partial<T> = {}
): UseFormValidationReturn<T> {
  const [values, setValuesState] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((field: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(newValues);
    setErrors({});
  }, []);

  const validateField = useCallback((field: keyof T): boolean => {
    try {
      // Create a schema that only validates this field
      const fieldSchema = (schema as any).pick({ [field]: true });
      const result = fieldSchema.safeParse({ [field]: values[field] });
      
      if (!result.success) {
        const fieldError = result.error.issues.find((err: any) => 
          err.path.includes(field as string)
        );
        if (fieldError) {
          setErrors(prev => ({
            ...prev,
            [field as string]: fieldError.message
          }));
          return false;
        }
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
        return true;
      }
    } catch (error) {
      // If pick doesn't work, fall back to full validation
      const result = schema.safeParse(values);
      if (!result.success) {
        const fieldError = result.error.issues.find((err: any) => 
          err.path.includes(field as string)
        );
        if (fieldError) {
          setErrors(prev => ({
            ...prev,
            [field as string]: fieldError.message
          }));
          return false;
        }
      }
    }
    
    return true;
  }, [schema, values]);

  const validateForm = useCallback((): ValidationResult<T> => {
    const result = schema.safeParse(values);
    
    if (result.success) {
      setErrors({});
      return { success: true, data: result.data };
    } else {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((error) => {
        const path = error.path.join('.');
        newErrors[path] = error.message;
      });
      setErrors(newErrors);
      return { success: false, errors: newErrors };
    }
  }, [schema, values]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    isValid,
    setValue,
    setValues,
    validateField,
    validateForm,
    clearErrors,
    reset,
  };
}

export default useFormValidation;