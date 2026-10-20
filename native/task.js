import { HeadlessEntryPointRegistry } from '@amazon-devices/headless-task-manager';
import { name } from './app.json';
import { runBotTask } from './src/botTask';

HeadlessEntryPointRegistry.registerHeadlessEntryPoint(
  name.replace(/\.main$/, '.search') + '::doTask',
  () => runBotTask,
);
