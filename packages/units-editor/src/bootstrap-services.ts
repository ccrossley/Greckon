import {
  AppPart,
  createServiceLocator,
  registerUnitsEditorServices,
  setAppServices,
} from '@greckon/services';

const services = createServiceLocator();
registerUnitsEditorServices(services);
setAppServices(services, AppPart.UnitsEditor);
