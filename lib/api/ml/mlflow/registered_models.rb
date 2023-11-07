# frozen_string_literal: true

require 'mime/types'

module API
  # MLFlow integration API, replicating the Rest API https://www.mlflow.org/docs/latest/rest-api.html#rest-api
  module Ml
    module Mlflow
      class RegisteredModels < ::API::Base
        feature_category :mlops

        before do
          check_api_read!
          check_api_write! unless request.get? || request.head?
        end

        resource 'registered-models' do
          desc 'Creates a Registered Model.' do
            success Entities::Ml::Mlflow::RegisteredModel
            detail 'MLFlow Registered Models map to GitLab Models. https://mlflow.org/docs/2.6.0/rest-api.html#create-registeredmodel'
          end
          params do
            requires :name, type: String,
              desc: 'Register models under this name.'
            optional :description, type: String,
              desc: 'Optional description for registered model.'
            optional :tags, type: Array, desc: 'Additional metadata for registered model.'
          end
          post 'create', urgency: :low do
            present ::Ml::CreateModelService.new(
              user_project,
              params[:name],
              current_user,
              params[:description],
              params[:tags]
            ).execute,
              with: Entities::Ml::Mlflow::RegisteredModel,
              root: :registered_model
          rescue ActiveRecord::RecordInvalid
            resource_already_exists!
          end

          desc 'Fetch a Registered Model by Name' do
            success Entities::Ml::Mlflow::RegisteredModel
            detail 'https://www.mlflow.org/docs/1.28.0/rest-api.html#get-registeredmodel'
          end
          params do
            # The name param is actually required, however it is listed as optional here
            # we can send a custom error response required by MLFlow
            optional :name, type: String, default: '',
              desc: 'Registered model unique name identifier, in reference to the project'
          end
          get 'get', urgency: :low do
            resource_not_found! unless params[:name]

            model = ::Ml::FindModelService.new(user_project, params[:name]).execute

            resource_not_found! if model.nil?

            present model, with: Entities::Ml::Mlflow::RegisteredModel, root: :registered_model
          end

          desc 'Update a Registered Model by Name' do
            success Entities::Ml::Mlflow::RegisteredModel
            detail 'https://mlflow.org/docs/2.6.0/rest-api.html#update-registeredmodel'
          end
          params do
            # The name param is actually required, however it is listed as optional here
            # we can send a custom error response required by MLFlow
            optional :name, type: String,
              desc: 'Registered model unique name identifier, in reference to the project'
            optional :description, type: String,
              desc: 'Optional description for registered model.'
          end
          patch 'update', urgency: :low do
            resource_not_found! unless params[:name]

            model = ::Ml::FindModelService.new(user_project, params[:name]).execute

            resource_not_found! if model.nil?

            present ::Ml::UpdateModelService.new(model, params[:description]).execute,
              with: Entities::Ml::Mlflow::RegisteredModel, root: :registered_model
          end
        end
      end
    end
  end
end
