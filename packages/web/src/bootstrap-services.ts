import {
  AppPart,
  createServiceLocator,
  registerWebServices,
  setAppServices,
} from '@greckon/services';

const services = createServiceLocator();
registerWebServices(services);
setAppServices(services, AppPart.Web);
