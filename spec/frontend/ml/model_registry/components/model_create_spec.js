import Vue from 'vue';
import VueApollo from 'vue-apollo';
import { GlAlert, GlModal } from '@gitlab/ui';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import * as Sentry from '~/sentry/sentry_browser_wrapper';
import { visitUrl } from '~/lib/utils/url_utility';
import ModelCreate from '~/ml/model_registry/components/model_create.vue';
import ImportArtifactZone from '~/ml/model_registry/components/import_artifact_zone.vue';
import { uploadModel } from '~/ml/model_registry/services/upload_model';
import createModelMutation from '~/ml/model_registry/graphql/mutations/create_model.mutation.graphql';
import createModelVersionMutation from '~/ml/model_registry/graphql/mutations/create_model_version.mutation.graphql';
import createMockApollo from 'helpers/mock_apollo_helper';
import waitForPromises from 'helpers/wait_for_promises';

import { createModelResponses, createModelVersionResponses } from '../graphql_mock_data';

Vue.use(VueApollo);

jest.mock('~/lib/utils/url_utility', () => ({
  ...jest.requireActual('~/lib/utils/url_utility'),
  visitUrl: jest.fn(),
}));

jest.mock('~/ml/model_registry/services/upload_model', () => ({
  uploadModel: jest.fn(),
}));

describe('ModelCreate', () => {
  let wrapper;
  let apolloProvider;

  beforeEach(() => {
    jest.spyOn(Sentry, 'captureException').mockImplementation();
  });

  afterEach(() => {
    apolloProvider = null;
  });

  const createWrapper = (
    createModelResolver = jest.fn().mockResolvedValue(createModelResponses.success),
    createModelVersionResolver = jest.fn().mockResolvedValue(createModelVersionResponses.success),
    createModelVisible = false,
  ) => {
    const requestHandlers = [
      [createModelMutation, createModelResolver],
      [createModelVersionMutation, createModelVersionResolver],
    ];
    apolloProvider = createMockApollo(requestHandlers);

    wrapper = shallowMountExtended(ModelCreate, {
      propsData: {
        createModelVisible,
      },
      provide: {
        projectPath: 'some/project',
      },
      apolloProvider,
    });
  };

  const findModalButton = () => wrapper.findByText('Create model');
  const findNameInput = () => wrapper.findByTestId('nameId');
  const findVersionInput = () => wrapper.findByTestId('versionId');
  const findDescriptionInput = () => wrapper.findByTestId('descriptionId');
  const findVersionDescriptionInput = () => wrapper.findByTestId('versionDescriptionId');
  const findImportArtifactZone = () => wrapper.findComponent(ImportArtifactZone);
  const findGlModal = () => wrapper.findComponent(GlModal);
  const findGlAlert = () => wrapper.findComponent(GlAlert);
  const submitForm = async () => {
    findGlModal().vm.$emit('primary', new Event('primary'));
    await waitForPromises();
  };

  describe('Initial state', () => {
    describe('Modal closed', () => {
      beforeEach(() => {
        createWrapper();
      });

      it('does not show modal', () => {
        expect(findGlModal().props('visible')).toBe(false);
      });

      it('renders the modal button', () => {
        expect(findModalButton().text()).toBe('Create model');
      });

      it('clicking create button triggers show-create-model', async () => {
        await findModalButton().vm.$emit('click');

        expect(wrapper.emitted('show-create-model')).toHaveLength(1);
      });
    });

    describe('Modal open', () => {
      beforeEach(() => {
        createWrapper(
          jest.fn().mockResolvedValue(createModelResponses.success),
          jest.fn().mockResolvedValue(createModelVersionResponses.success),
          true,
        );
      });

      it('shows the modal', () => {
        expect(findGlModal().props('visible')).toBe(true);
      });

      it('renders the name input', () => {
        expect(findNameInput().exists()).toBe(true);
      });

      it('renders the version input', () => {
        expect(findVersionInput().exists()).toBe(true);
      });

      it('renders the description input', () => {
        expect(findDescriptionInput().exists()).toBe(true);
      });

      it('renders the version description input', () => {
        expect(findVersionDescriptionInput().exists()).toBe(true);
      });

      it('renders the import artifact zone input', () => {
        expect(findImportArtifactZone().exists()).toBe(false);
      });

      it('renders the import artifact zone input with version entered', async () => {
        findNameInput().vm.$emit('input', 'gpt-alice-1');
        findVersionInput().vm.$emit('input', '1.0.0');
        await waitForPromises();
        expect(findImportArtifactZone().props()).toEqual({
          path: null,
          submitOnSelect: false,
          value: { file: null, subfolder: '' },
        });
      });

      it('renders the import modal', () => {
        expect(findGlModal().props()).toMatchObject({
          modalId: 'create-model-modal',
          title: 'Create model, version & import artifacts',
          size: 'sm',
        });
      });

      it('renders the cancel button in the modal', () => {
        expect(findGlModal().props('actionCancel')).toEqual({ text: 'Cancel' });
      });

      it('renders the create button in the modal', () => {
        expect(findGlModal().props('actionPrimary')).toEqual({
          attributes: { variant: 'confirm' },
          text: 'Create',
        });
      });

      it('does not render the alert by default', () => {
        expect(findGlAlert().exists()).toBe(false);
      });

      it('clicking on cancel button triggers hide-create-model', async () => {
        await findGlModal().vm.$emit('cancel');

        expect(wrapper.emitted('hide-create-model')).toHaveLength(1);
      });
    });
  });

  describe('Successful flow with version', () => {
    beforeEach(async () => {
      createWrapper();
      findNameInput().vm.$emit('input', 'gpt-alice-1');
      findVersionInput().vm.$emit('input', '1.0.0');
      findDescriptionInput().vm.$emit('input', 'My model description');
      findVersionDescriptionInput().vm.$emit('input', 'My version description');
      jest.spyOn(apolloProvider.defaultClient, 'mutate');

      await submitForm();
    });

    it('Makes a create model mutation upon confirm', () => {
      expect(apolloProvider.defaultClient.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: createModelMutation,
          variables: {
            projectPath: 'some/project',
            name: 'gpt-alice-1',
            description: 'My model description',
          },
        }),
      );
    });

    it('Makes a create model version mutation upon confirm', () => {
      expect(apolloProvider.defaultClient.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: createModelVersionMutation,
          variables: {
            modelId: 'gid://gitlab/Ml::Model/1',
            projectPath: 'some/project',
            version: '1.0.0',
            description: 'My version description',
          },
        }),
      );
    });

    it('Uploads a file mutation upon confirm', () => {
      expect(uploadModel).toHaveBeenCalledWith({
        file: null,
        importPath: '/api/v4/projects/1/packages/ml_models/1/files/',
        subfolder: '',
      });
    });

    it('Visits the model versions page upon successful create mutation', async () => {
      createWrapper();
      await submitForm();
      expect(visitUrl).toHaveBeenCalledWith('/some/project/-/ml/models/1/versions/1');
    });
  });

  describe('Successful flow without version', () => {
    beforeEach(async () => {
      createWrapper();
      findNameInput().vm.$emit('input', 'gpt-alice-1');
      findDescriptionInput().vm.$emit('input', 'My model description');
      jest.spyOn(apolloProvider.defaultClient, 'mutate');

      await submitForm();
    });

    it('Visits the model page upon successful create mutation without a version', async () => {
      createWrapper();
      await submitForm();
      expect(visitUrl).toHaveBeenCalledWith('/some/project/-/ml/models/1');
    });
  });

  describe('Failed flow with version', () => {
    beforeEach(async () => {
      const failedCreateModelVersionResolver = jest
        .fn()
        .mockResolvedValue(createModelVersionResponses.failure);
      createWrapper(undefined, failedCreateModelVersionResolver);
      jest.spyOn(apolloProvider.defaultClient, 'mutate');

      findNameInput().vm.$emit('input', 'gpt-alice-1');
      findVersionInput().vm.$emit('input', '1.0.0');
      findVersionDescriptionInput().vm.$emit('input', 'My version description');
      await submitForm();
    });

    it('Displays an alert upon failed model  create mutation', () => {
      expect(findGlAlert().text()).toBe('Version is invalid');
    });
  });

  describe('Failed flow with version retried', () => {
    beforeEach(async () => {
      const failedCreateModelVersionResolver = jest
        .fn()
        .mockResolvedValueOnce(createModelVersionResponses.failure);
      createWrapper(undefined, failedCreateModelVersionResolver);
      jest.spyOn(apolloProvider.defaultClient, 'mutate');

      findNameInput().vm.$emit('input', 'gpt-alice-1');
      findVersionInput().vm.$emit('input', '1.0.0');
      findVersionDescriptionInput().vm.$emit('input', 'My retried version description');
      await submitForm();
    });

    it('Displays an alert upon failed model create mutation', async () => {
      expect(findGlAlert().text()).toBe('Version is invalid');

      await submitForm();

      expect(apolloProvider.defaultClient.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: createModelVersionMutation,
          variables: {
            modelId: 'gid://gitlab/Ml::Model/1',
            projectPath: 'some/project',
            version: '1.0.0',
            description: 'My retried version description',
          },
        }),
      );
    });
  });

  describe('Failed flow with file upload retried', () => {
    beforeEach(async () => {
      createWrapper();
      findNameInput().vm.$emit('input', 'gpt-alice-1');
      findVersionInput().vm.$emit('input', '1.0.0');
      findDescriptionInput().vm.$emit('input', 'My model description');
      findVersionDescriptionInput().vm.$emit('input', 'My version description');
      uploadModel.mockRejectedValueOnce('Artifact import error.');
      await submitForm();
    });

    it('Visits the model versions page upon successful create mutation', async () => {
      expect(findGlAlert().text()).toBe('Artifact import error.');
      await submitForm(); // retry submit
      expect(visitUrl).toHaveBeenCalledWith('/some/project/-/ml/models/1/versions/1');
    });
  });

  describe('Failed flow without version', () => {
    describe('Mutation errors', () => {
      beforeEach(async () => {
        const failedCreateModelResolver = jest
          .fn()
          .mockResolvedValue(createModelResponses.validationFailure);
        createWrapper(failedCreateModelResolver);
        jest.spyOn(apolloProvider.defaultClient, 'mutate');

        findNameInput().vm.$emit('input', 'gpt-alice-1');
        await submitForm();
      });

      it('Displays an alert upon failed model  create mutation', () => {
        expect(findGlAlert().text()).toBe("Name is invalid, Name can't be blank");
      });

      it('Displays an alert upon an exception', () => {
        expect(findGlAlert().text()).toBe("Name is invalid, Name can't be blank");
      });
    });

    it('Logs to sentry upon an exception', async () => {
      const error = new Error('Runtime error');
      createWrapper();
      jest.spyOn(apolloProvider.defaultClient, 'mutate').mockImplementation(() => {
        throw error;
      });

      findNameInput().vm.$emit('input', 'gpt-alice-1');
      await submitForm();

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });
});
